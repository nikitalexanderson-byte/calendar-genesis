<?php
declare(strict_types=1);

const GENESIS_GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';
const GENESIS_GEMINI_DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GENESIS_GEMINI_MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const GENESIS_GEMINI_AUDIO_MIME_TYPES = [
    'audio/aac',
    'audio/flac',
    'audio/m4a',
    'audio/mp3',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/opus',
    'audio/wav',
    'audio/webm',
];

function genesisGeminiApiKey(): string
{
    $environmentKey = getenv('GEMINI_API_KEY');
    if (is_string($environmentKey) && trim($environmentKey) !== '') {
        return trim($environmentKey);
    }
    return trim((string)(genesisConfig()['gemini_api_key'] ?? ''));
}

function genesisGeminiModel(): string
{
    $configured = trim((string)(genesisConfig()['gemini_model'] ?? GENESIS_GEMINI_DEFAULT_MODEL));
    return preg_match('/^[a-z0-9][a-z0-9._-]{2,80}$/', $configured) === 1
        ? $configured
        : GENESIS_GEMINI_DEFAULT_MODEL;
}

function genesisGeminiEndpoint(): string
{
    $configured = trim((string)(genesisConfig()['gemini_api_endpoint'] ?? ''));
    if ($configured === '') {
        return GENESIS_GEMINI_DEFAULT_ENDPOINT;
    }
    $parts = parse_url($configured);
    return is_array($parts)
        && ($parts['scheme'] ?? '') === 'https'
        && is_string($parts['host'] ?? null)
        && trim((string)$parts['host']) !== ''
            ? $configured
            : GENESIS_GEMINI_DEFAULT_ENDPOINT;
}

function genesisGeminiRequest(array $request): array
{
    try {
        return genesisCurl(genesisGeminiEndpoint(), [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'x-goog-api-key: ' . genesisGeminiApiKey(),
            ],
            CURLOPT_TIMEOUT => 90,
        ]);
    } catch (RuntimeException $error) {
        $message = mb_strtolower($error->getMessage());
        if (str_contains($message, 'not available in your current location')
            || str_contains($message, 'user location is not supported')) {
            genesisJson(['error' => 'GEMINI_REGION_UNAVAILABLE'], 503);
        }
        if (str_contains($message, 'api key not valid')
            || str_contains($message, 'api_key_invalid')
            || str_contains($message, 'permission denied')) {
            genesisJson(['error' => 'GEMINI_KEY_INVALID'], 503);
        }
        throw $error;
    }
}

function genesisGeminiAvailable(): bool
{
    return genesisGeminiApiKey() !== '';
}

function genesisGeminiRateLimit(): void
{
    $now = time();
    $windowStart = $now - 600;
    $requests = array_values(array_filter(
        is_array($_SESSION['gemini_requests'] ?? null) ? $_SESSION['gemini_requests'] : [],
        static fn(mixed $value): bool => is_int($value) && $value >= $windowStart,
    ));
    if (count($requests) >= 12) {
        genesisJson(['error' => 'GEMINI_RATE_LIMIT'], 429);
    }
    $requests[] = $now;
    $_SESSION['gemini_requests'] = $requests;
}

function genesisGeminiString(mixed $value, int $limit): string
{
    return mb_substr(trim(is_string($value) ? $value : ''), 0, $limit);
}

function genesisGeminiStringList(mixed $value, int $itemLimit, int $countLimit): array
{
    if (!is_array($value)) {
        return [];
    }
    $result = [];
    foreach (array_slice($value, 0, $countLimit) as $item) {
        $clean = genesisGeminiString($item, $itemLimit);
        if ($clean !== '') {
            $result[] = $clean;
        }
    }
    return array_values(array_unique($result));
}

function genesisGeminiContext(mixed $value): array
{
    $context = is_array($value) ? $value : [];
    $language = ($context['language'] ?? '') === 'en' ? 'en' : 'ru';
    $calendarMode = in_array($context['calendarMode'] ?? '', ['profane', 'sacred', 'lunar'], true)
        ? (string)$context['calendarMode']
        : 'sacred';
    $today = genesisGeminiString($context['today'] ?? '', 10);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $today) !== 1) {
        $today = (new DateTimeImmutable('now', genesisClientTimeZone()))->format('Y-m-d');
    }

    $cleanRows = static function (mixed $rows, array $fields, int $limit): array {
        if (!is_array($rows)) {
            return [];
        }
        $result = [];
        foreach (array_slice($rows, 0, $limit) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $clean = [];
            foreach ($fields as $field => $length) {
                $clean[$field] = genesisGeminiString($row[$field] ?? '', $length);
            }
            if (($clean['title'] ?? $clean['name'] ?? $clean['email'] ?? '') !== '') {
                $result[] = $clean;
            }
        }
        return $result;
    };

    return [
        'language' => $language,
        'calendarMode' => $calendarMode,
        'today' => $today,
        'timeZone' => genesisGeminiString($context['timeZone'] ?? '', 80),
        'categories' => $cleanRows($context['categories'] ?? [], ['name' => 100], 100),
        'projects' => $cleanRows($context['projects'] ?? [], [
            'title' => 160,
            'parent' => 160,
            'category' => 100,
        ], 250),
        'taskLists' => $cleanRows($context['taskLists'] ?? [], [
            'title' => 160,
            'accountEmail' => 254,
        ], 100),
        'accounts' => $cleanRows($context['accounts'] ?? [], ['email' => 254], 20),
    ];
}

function genesisGeminiPlanSchema(): array
{
    $text = static fn(string $description = ''): array => [
        'type' => 'string',
        'description' => $description,
    ];
    $stringArray = static fn(string $description = ''): array => [
        'type' => 'array',
        'description' => $description,
        'items' => ['type' => 'string'],
    ];

    return [
        'type' => 'object',
        'additionalProperties' => false,
        'properties' => [
            'request' => $text('A concise transcript or restatement of what the user asked.'),
            'summary' => $text('A concise summary of the proposed changes in the user language.'),
            'projects' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => [
                        'title' => $text(),
                        'description' => $text(),
                        'parentProject' => $text('Exact existing or newly proposed parent project title, or empty string.'),
                        'category' => $text('Exact existing category name, or empty string.'),
                        'tags' => $stringArray(),
                    ],
                    'required' => ['title', 'description', 'parentProject', 'category', 'tags'],
                ],
            ],
            'taskLists' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => [
                        'title' => $text(),
                        'project' => $text('Exact existing or newly proposed project title, or empty string.'),
                        'accountEmail' => $text('Exact connected account email when the user chose one, or empty string.'),
                    ],
                    'required' => ['title', 'project', 'accountEmail'],
                ],
            ],
            'tasks' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => [
                        'title' => $text(),
                        'description' => $text(),
                        'startDate' => $text('Gregorian YYYY-MM-DD date when work starts.'),
                        'dueDate' => $text('Gregorian YYYY-MM-DD final deadline, never before startDate.'),
                        'time' => $text('24-hour HH:MM start time, or empty string.'),
                        'project' => $text('Exact existing or newly proposed project title, or empty string.'),
                        'taskList' => $text('Exact existing or newly proposed Google Tasks list title, or empty string.'),
                        'tags' => $stringArray(),
                        'priority' => [
                            'type' => 'integer',
                            'minimum' => 1,
                            'maximum' => 10,
                        ],
                        'reminderMinutes' => [
                            'type' => 'integer',
                            'minimum' => 0,
                            'maximum' => 43200,
                            'description' => 'Minutes before the task; zero means no reminder.',
                        ],
                    ],
                    'required' => ['title', 'description', 'startDate', 'dueDate', 'time', 'project', 'taskList', 'tags', 'priority', 'reminderMinutes'],
                ],
            ],
        ],
        'required' => ['request', 'summary', 'projects', 'taskLists', 'tasks'],
    ];
}

function genesisGeminiOutputText(array $response): string
{
    $steps = is_array($response['steps'] ?? null) ? $response['steps'] : [];
    for ($stepIndex = count($steps) - 1; $stepIndex >= 0; $stepIndex--) {
        $step = $steps[$stepIndex] ?? null;
        if (!is_array($step) || ($step['type'] ?? '') !== 'model_output') {
            continue;
        }
        $content = is_array($step['content'] ?? null) ? $step['content'] : [];
        for ($contentIndex = count($content) - 1; $contentIndex >= 0; $contentIndex--) {
            $part = $content[$contentIndex] ?? null;
            if (is_array($part) && ($part['type'] ?? '') === 'text' && is_string($part['text'] ?? null)) {
                return trim($part['text']);
            }
        }
    }
    throw new RuntimeException('Gemini returned no planning result.');
}

function genesisNormalizeGeminiPlan(array $plan): array
{
    $projects = [];
    foreach (array_slice(is_array($plan['projects'] ?? null) ? $plan['projects'] : [], 0, 20) as $project) {
        if (!is_array($project)) continue;
        $title = genesisGeminiString($project['title'] ?? '', 160);
        if ($title === '') continue;
        $projects[] = [
            'title' => $title,
            'description' => genesisGeminiString($project['description'] ?? '', 2000),
            'parentProject' => genesisGeminiString($project['parentProject'] ?? '', 160),
            'category' => genesisGeminiString($project['category'] ?? '', 100),
            'tags' => genesisGeminiStringList($project['tags'] ?? [], 60, 10),
        ];
    }

    $taskLists = [];
    foreach (array_slice(is_array($plan['taskLists'] ?? null) ? $plan['taskLists'] : [], 0, 20) as $taskList) {
        if (!is_array($taskList)) continue;
        $title = genesisGeminiString($taskList['title'] ?? '', 160);
        if ($title === '') continue;
        $taskLists[] = [
            'title' => $title,
            'project' => genesisGeminiString($taskList['project'] ?? '', 160),
            'accountEmail' => genesisGeminiString($taskList['accountEmail'] ?? '', 254),
        ];
    }

    $tasks = [];
    foreach (array_slice(is_array($plan['tasks'] ?? null) ? $plan['tasks'] : [], 0, 100) as $task) {
        if (!is_array($task)) continue;
        $title = genesisGeminiString($task['title'] ?? '', 300);
        if ($title === '') continue;
        $startDate = genesisGeminiString($task['startDate'] ?? '', 10);
        $dueDate = genesisGeminiString($task['dueDate'] ?? '', 10);
        $time = genesisGeminiString($task['time'] ?? '', 5);
        $tasks[] = [
            'title' => $title,
            'description' => genesisGeminiString($task['description'] ?? '', 4000),
            'startDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) === 1 ? $startDate : '',
            'dueDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate) === 1 ? $dueDate : '',
            'time' => preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time) === 1 ? $time : '',
            'project' => genesisGeminiString($task['project'] ?? '', 160),
            'taskList' => genesisGeminiString($task['taskList'] ?? '', 160),
            'tags' => genesisGeminiStringList($task['tags'] ?? [], 60, 6),
            'priority' => genesisClampInt($task['priority'] ?? 5, 1, 10, 5),
            'reminderMinutes' => genesisClampInt($task['reminderMinutes'] ?? 0, 0, 43200, 0),
        ];
    }

    return [
        'request' => genesisGeminiString($plan['request'] ?? '', 2000),
        'summary' => genesisGeminiString($plan['summary'] ?? '', 2000),
        'projects' => $projects,
        'taskLists' => $taskLists,
        'tasks' => $tasks,
    ];
}

function genesisCreateGeminiPlan(array $payload): array
{
    if (!genesisGeminiAvailable()) {
        genesisJson(['error' => 'GEMINI_NOT_CONFIGURED'], 503);
    }

    $command = genesisGeminiString($payload['command'] ?? '', 4000);
    $audio = is_array($payload['audio'] ?? null) ? $payload['audio'] : null;
    if ($command === '' && $audio === null) {
        throw new InvalidArgumentException('Voice recording or command text is required.');
    }

    $context = genesisGeminiContext($payload['context'] ?? []);
    $input = [[
        'type' => 'text',
        'text' => "Current GENESIS context (user-provided planning metadata):\n"
            . json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)
            . "\n\nWritten command (may be empty when audio is present):\n"
            . $command,
    ]];

    if ($audio !== null) {
        $mimeType = strtolower(trim(explode(';', genesisGeminiString($audio['mimeType'] ?? '', 100), 2)[0]));
        if (!in_array($mimeType, GENESIS_GEMINI_AUDIO_MIME_TYPES, true)) {
            throw new InvalidArgumentException('Unsupported audio format.');
        }
        $decoded = base64_decode((string)($audio['data'] ?? ''), true);
        if (!is_string($decoded) || $decoded === '' || strlen($decoded) > GENESIS_GEMINI_MAX_AUDIO_BYTES) {
            throw new InvalidArgumentException('Voice recording is empty or too large.');
        }
        $input[] = [
            'type' => 'audio',
            'data' => base64_encode($decoded),
            'mime_type' => $mimeType,
        ];
    }

    genesisGeminiRateLimit();

    $languageInstruction = $context['language'] === 'en'
        ? 'Write request and summary in English.'
        : 'Write request and summary in Russian.';
    $systemInstruction = <<<PROMPT
You are the planning parser for the GENESIS calendar. Convert the user's written or spoken request into a draft only. Never execute actions and never invent goals the user did not request.

Rules:
- Return only the structured response required by the JSON schema.
- {$languageInstruction}
- Interpret relative dates using context.today and context.timeZone. All output dates must be Gregorian ISO YYYY-MM-DD.
- startDate is when work starts; dueDate is the final deadline. If only one date is given, use it for both. If no date is given, use context.today for both.
- Never make dueDate earlier than startDate. Do not choose a past date unless the user explicitly named that past date.
- Match existing project, category, task-list, and account names exactly when the user refers to them.
- Add an item to projects or taskLists only when the user explicitly asks to create it. A task may reference an existing item without recreating it.
- A taskLists item means a Google Tasks list. Use accountEmail only when the user selected a connected account.
- Keep titles concise. Preserve meaningful wording from the user. Use empty strings and empty arrays for omitted optional details.
- priority is 1 to 10 (10 is highest); default to 5. reminderMinutes is 0 when no reminder was requested.
- If the request is not about creating projects, Google Tasks lists, or tasks, return empty action arrays and explain briefly in summary.
PROMPT;

    $request = [
        'model' => genesisGeminiModel(),
        'input' => $input,
        'system_instruction' => $systemInstruction,
        'store' => false,
        'generation_config' => [
            'temperature' => 0.1,
            'max_output_tokens' => 8192,
        ],
        'response_format' => [
            'type' => 'text',
            'mime_type' => 'application/json',
            'schema' => genesisGeminiPlanSchema(),
        ],
    ];

    $response = genesisGeminiRequest($request);

    $plan = json_decode(genesisGeminiOutputText($response), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($plan)) {
        throw new RuntimeException('Gemini returned an invalid planning result.');
    }

    return [
        'model' => genesisGeminiModel(),
        'plan' => genesisNormalizeGeminiPlan($plan),
    ];
}
