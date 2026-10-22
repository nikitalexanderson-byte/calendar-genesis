<?php
declare(strict_types=1);

const GENESIS_ADVICE_CATEGORIES = ['aretology', 'hermetica', 'kourotrophy', 'hestiology', 'aphrodisia', 'psychopompia'];

function genesisAdvicePreferences(mixed $value): array
{
    $value = is_string($value) ? json_decode($value, true, 16, JSON_THROW_ON_ERROR) : $value;
    if (!is_array($value) || array_diff(array_keys($value), ['enabled', 'smart', 'categories'])) {
        throw new InvalidArgumentException('INVALID_ADVICE_PREFERENCES');
    }
    $result = ['enabled' => $value['enabled'] ?? true, 'smart' => $value['smart'] ?? true,
        'categories' => $value['categories'] ?? GENESIS_ADVICE_CATEGORIES];
    if (!is_bool($result['enabled']) || !is_bool($result['smart']) || !is_array($result['categories'])
        || !array_is_list($result['categories']) || array_filter($result['categories'],
            static fn($id) => !is_string($id) || !in_array($id, GENESIS_ADVICE_CATEGORIES, true))) {
        throw new InvalidArgumentException('INVALID_ADVICE_PREFERENCES');
    }
    $result['categories'] = array_values(array_unique($result['categories']));
    if (!$result['smart'] && $result['categories'] === []) throw new InvalidArgumentException('ADVICE_CATEGORY_REQUIRED');
    return $result;
}

/** The corpus is deployed with code; requests can never provide a file path or an advice body. */
function genesisAdviceCatalog(): array
{
    static $items;
    if (is_array($items)) return $items;
    $catalog = json_decode(file_get_contents(dirname(__DIR__) . '/content/daily-advice.json'), true, 32, JSON_THROW_ON_ERROR);
    if (($catalog['version'] ?? null) !== 1 || !is_array($catalog['items'] ?? null)) throw new RuntimeException('INVALID_ADVICE_CATALOG');
    $items = []; $ids = [];
    foreach ($catalog['items'] as $entry) {
        if (!is_array($entry) || !is_string($entry['id'] ?? null) || !preg_match('/^advice-[a-f0-9]{24}$/D', $entry['id'])
            || isset($ids[$entry['id']]) || !is_string($entry['body'] ?? null) || trim($entry['body']) === ''
            || strlen($entry['body']) > 24000 || !is_array($entry['categories'] ?? null) || $entry['categories'] === []
            || array_diff($entry['categories'], GENESIS_ADVICE_CATEGORIES)
            || !is_string($entry['language'] ?? null) || !is_array($entry['sources'] ?? null)) {
            throw new RuntimeException('INVALID_ADVICE_CATALOG_ENTRY');
        }
        $ids[$entry['id']] = true; $items[] = $entry;
    }
    return $items;
}

/** Use the server clock and the existing device time-zone header, never a client date. */
function genesisAdviceDayKey(): string
{
    $zone = $_SERVER['HTTP_X_GENESIS_TIME_ZONE'] ?? 'Europe/Moscow';
    if (!is_string($zone) || !in_array($zone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
        $zone = 'Europe/Moscow';
    }
    return (new DateTimeImmutable('now', new DateTimeZone($zone)))->format('Y-m-d');
}

function genesisAdviceScores(mixed $value): array
{
    if (!is_array($value) || array_diff(array_keys($value), GENESIS_ADVICE_CATEGORIES)) throw new InvalidArgumentException('INVALID_ADVICE_CONTEXT');
    $scores = [];
    foreach (GENESIS_ADVICE_CATEGORIES as $id) {
        $score = $value[$id] ?? 0;
        if ((!is_int($score) && !is_float($score)) || !is_finite((float)$score) || $score < 0 || $score > 1000) {
            throw new InvalidArgumentException('INVALID_ADVICE_CONTEXT');
        }
        $scores[$id] = (float)$score;
    }
    return $scores;
}

/** Unseen posts lead; then the least recently viewed eligible post starts the next turn. */
function genesisChooseAdvice(array $items, array $preferences, array $scores, array $history, string $seed): ?array
{
    $categories = $preferences['smart'] ? array_keys(array_filter($scores, static fn($weight) => $weight > 0)) : $preferences['categories'];
    if ($preferences['smart'] && $categories === []) $categories = GENESIS_ADVICE_CATEGORIES;
    $eligible = array_values(array_filter($items, static fn($entry) => array_intersect($entry['categories'], $categories) !== []));
    if ($eligible === []) return null;
    $lastShown = []; $recentCategories = [];
    foreach ($history as $index => $row) {
        $id = $row['advice_id'];
        $lastShown[$id] ??= $row['day_key'];
        if ($index < 3) {
            $entry = json_decode($row['entry_json'], true, 32, JSON_THROW_ON_ERROR);
            foreach ($entry['categories'] as $category) $recentCategories[$category] = ($recentCategories[$category] ?? 0) + 1;
        }
    }
    $best = null; $bestRank = null;
    foreach ($eligible as $entry) {
        $affinity = 0.0; $recent = 0;
        foreach (array_intersect($entry['categories'], $categories) as $category) {
            $affinity = max($affinity, $preferences['smart'] ? log(1 + ($scores[$category] ?? 0)) : 1.0);
            $recent = max($recent, $recentCategories[$category] ?? 0);
        }
        // A completed round starts with the longest-unseen entries; new entries always lead.
        $rank = [$lastShown[$entry['id']] ?? '', -($affinity / (1 + $recent)), hash('sha256', $seed . ':' . $entry['id'])];
        if ($bestRank === null || $rank < $bestRank) { $best = $entry; $bestRank = $rank; }
    }
    return $best;
}

function genesisAdviceForClient(array $row): array
{
    return [...json_decode($row['entry_json'], true, 32, JSON_THROW_ON_ERROR),
        'dayKey' => $row['day_key'], 'dismissed' => $row['dismissed_at'] !== null];
}

function genesisDailyAdvice(string $userId, array $payload, ?array $catalogFixture = null): array
{
    $scores = genesisAdviceScores($payload['scores'] ?? []);
    $day = genesisAdviceDayKey(); $db = genesisDb();
    genesisBeginWriteTransaction($db);
    try {
        $user = genesisFindUser($userId);
        if ($user === null) throw new DomainException('AUTH_REQUIRED');
        $preferences = genesisAdvicePreferences($user['advice_preferences_json'] ?? '{}');
        $result = ['dayKey' => $day, 'advice' => null, 'state' => 'disabled'];
        if ($preferences['enabled']) {
            $query = $db->prepare('SELECT * FROM daily_advice_days WHERE user_id = ? AND day_key = ?');
            $query->execute([$userId, $day]); $row = $query->fetch();
            if (!is_array($row)) {
                // The optional fixture is used only by isolated backend tests, never by HTTP input.
                $items = $catalogFixture ?? genesisAdviceCatalog();
                $history = $db->prepare('SELECT advice_id, day_key, entry_json FROM daily_advice_days WHERE user_id = ? AND viewed_at IS NOT NULL ORDER BY day_key DESC');
                $history->execute([$userId]);
                $entry = genesisChooseAdvice($items, $preferences, $scores, $history->fetchAll(), $userId . ':' . $day);
                if ($entry !== null) {
                    $row = ['day_key' => $day, 'entry_json' => json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'dismissed_at' => null];
                    $db->prepare('INSERT INTO daily_advice_days(user_id, day_key, advice_id, entry_json, created_at) VALUES (?, ?, ?, ?, ?)')
                        ->execute([$userId, $day, $entry['id'], $row['entry_json'], genesisNow()]);
                }
                $result['state'] = $items === [] ? 'empty' : 'no-match';
            }
            if (is_array($row)) { $result['advice'] = genesisAdviceForClient($row); $result['state'] = 'ready'; }
        }
        $db->commit(); return $result;
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

/** A view is acknowledged only when the card enters the visible viewport. Both operations are idempotent. */
function genesisRecordAdvice(string $userId, array $payload, bool $dismiss): array
{
    $day = $payload['dayKey'] ?? null; $id = $payload['id'] ?? null;
    if (!is_string($day) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $day) || !is_string($id)) throw new InvalidArgumentException('INVALID_ADVICE_VIEW');
    $sql = $dismiss ? 'viewed_at = COALESCE(viewed_at, :now), dismissed_at = COALESCE(dismissed_at, :now)' : 'viewed_at = COALESCE(viewed_at, :now)';
    $query = genesisDb()->prepare("UPDATE daily_advice_days SET $sql WHERE user_id = :user AND day_key = :day AND advice_id = :id");
    $query->execute(['now' => genesisNow(), 'user' => $userId, 'day' => $day, 'id' => $id]);
    return ['ok' => true];
}
