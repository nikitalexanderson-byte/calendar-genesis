<?php
declare(strict_types=1);
require_once __DIR__ . '/calendar.php';

const GENESIS_ADVICE_CATEGORIES = ['aretology', 'hermetica', 'kourotrophy', 'hestiology', 'aphrodisia', 'psychopompia'];
const GENESIS_ADVICE_LANGUAGES = ['ru', 'en', 'el', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'sr', 'uk', 'zh', 'tr', 'ja'];
const GENESIS_ADVICE_TOPICS = ['nutrition', 'training', 'recovery', 'discipline', 'clothing', 'attributes', 'cleaning', 'home_order', 'parenting', 'sons', 'heritage', 'fatherhood', 'motherhood'];

function genesisAdvicePreferences(mixed $value): array
{
    $value = is_string($value) ? json_decode($value, true, 16, JSON_THROW_ON_ERROR) : $value;
    if (!is_array($value) || array_diff(array_keys($value), ['enabled', 'smart', 'categories', 'aphrodisiaAdult'])) {
        throw new InvalidArgumentException('INVALID_ADVICE_PREFERENCES');
    }
    $result = ['enabled' => $value['enabled'] ?? true, 'smart' => $value['smart'] ?? true,
        'categories' => $value['categories'] ?? array_values(array_diff(GENESIS_ADVICE_CATEGORIES, ['aphrodisia'])),
        'aphrodisiaAdult' => $value['aphrodisiaAdult'] ?? null];
    if (!is_bool($result['enabled']) || !is_bool($result['smart']) || ($result['aphrodisiaAdult'] !== null && !is_bool($result['aphrodisiaAdult'])) || !is_array($result['categories'])
        || !array_is_list($result['categories']) || array_filter($result['categories'],
            static fn($id) => !is_string($id) || !in_array($id, GENESIS_ADVICE_CATEGORIES, true))) {
        throw new InvalidArgumentException('INVALID_ADVICE_PREFERENCES');
    }
    $result['categories'] = array_values(array_unique($result['categories']));
    if (!$result['smart'] && $result['categories'] === []) throw new InvalidArgumentException('ADVICE_CATEGORY_REQUIRED');
    if ($result['aphrodisiaAdult'] === null) $result['categories'] = array_values(array_diff($result['categories'], ['aphrodisia']));
    if ($result['categories'] === []) $result['categories'] = array_values(array_diff(GENESIS_ADVICE_CATEGORIES, ['aphrodisia']));
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
        if (isset($entry['contentVersion'])) {
            if (!is_string($entry['contentVersion']) || !preg_match('/^[a-z0-9-]{1,80}$/D', $entry['contentVersion'])
                || !is_string($entry['title'] ?? null) || trim($entry['title']) === '' || strlen($entry['title']) > 2000
                || !is_string($entry['image'] ?? null)
                || !preg_match('~^/advice-art/[a-z0-9-]+/advice-[a-f0-9]{24}\.webp$~D', $entry['image'])
                || !is_array($entry['topics'] ?? null) || array_diff($entry['topics'], GENESIS_ADVICE_TOPICS)
                || !in_array($entry['status'] ?? 'published', ['published', 'draft'], true)) {
                throw new RuntimeException('INVALID_ADVICE_CONTENT');
            }
        }
        if (isset($entry['schedule']) && (!is_array($entry['schedule'])
            || !is_array($entry['schedule']['phases'] ?? null) || $entry['schedule']['phases'] === []
            || array_diff($entry['schedule']['phases'], ['new', 'full'])
            || !is_array($entry['schedule']['leadDays'] ?? null) || $entry['schedule']['leadDays'] === []
            || array_filter($entry['schedule']['leadDays'], static fn($day) => !is_int($day) || $day < 1 || $day > 3))) {
            throw new RuntimeException('INVALID_ADVICE_SCHEDULE');
        }
        if (isset($entry['timeOfDay']) && !in_array($entry['timeOfDay'], ['morning', 'evening'], true)) throw new RuntimeException('INVALID_ADVICE_TIME');
        if (isset($entry['priority']) && !is_bool($entry['priority'])) throw new RuntimeException('INVALID_ADVICE_PRIORITY');
        if (in_array('aphrodisia', $entry['categories'], true) && (!is_bool($entry['requiresAdult'] ?? null)
            || !in_array($entry['aphrodisiaTheme'] ?? null, ['love', 'aesthetics', 'consciousness'], true))) {
            throw new RuntimeException('INVALID_APHRODISIA_CONTENT');
        }
        $ids[$entry['id']] = true;
        if (($entry['status'] ?? 'published') !== 'draft') $items[] = $entry;
    }
    return $items;
}

function genesisAdviceAvailableCategories(?array $items = null): array
{
    $present = [];
    foreach ($items ?? genesisAdviceCatalog() as $entry) {
        if (($entry['status'] ?? 'published') !== 'draft') $present = [...$present, ...$entry['categories']];
    }
    return array_values(array_intersect(GENESIS_ADVICE_CATEGORIES, $present));
}

/** Use the server clock and the existing device time-zone header, never a client date. */
function genesisAdviceTimeZone(): string
{
    $zone = $_SERVER['HTTP_X_GENESIS_TIME_ZONE'] ?? 'Europe/Moscow';
    if (!is_string($zone) || !in_array($zone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
        $zone = 'Europe/Moscow';
    }
    return $zone;
}

function genesisAdviceDayKey(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone(genesisAdviceTimeZone())))->format('Y-m-d');
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

function genesisAdviceTopicScores(mixed $value): array
{
    if (!is_array($value) || array_diff(array_keys($value), GENESIS_ADVICE_TOPICS)) throw new InvalidArgumentException('INVALID_ADVICE_CONTEXT');
    $scores = [];
    foreach (GENESIS_ADVICE_TOPICS as $id) {
        $score = $value[$id] ?? 0;
        if ((!is_int($score) && !is_float($score)) || !is_finite((float)$score) || $score < 0 || $score > 1000) {
            throw new InvalidArgumentException('INVALID_ADVICE_CONTEXT');
        }
        $scores[$id] = (float)$score;
    }
    return $scores;
}

/** Lunar windows use civil dates in the device zone and the server's existing ephemeris. */
function genesisAdvicePhaseLeads(string $day, string $zone): array
{
    $data = genesisCalendarEphemeris(); $leads = [];
    $start = genesisCalendarDate($day)->getTimestamp() * 1000 - 36 * 3600000;
    foreach (['new' => 'newMoons', 'full' => 'fullMoons'] as $phase => $key) {
        $moments = $data[$key]; $low = 0; $high = count($moments);
        while ($low < $high) {
            $mid = intdiv($low + $high, 2);
            if ($moments[$mid] < $start) $low = $mid + 1; else $high = $mid;
        }
        for ($i = $low; isset($moments[$i]) && $moments[$i] <= $start + 6 * 86400000; $i++) {
            $eventDay = genesisCalendarEventDate($moments[$i], ['timeZone' => $zone]);
            $lead = genesisCalendarDayNumber($eventDay) - genesisCalendarDayNumber($day);
            if ($lead >= 1 && $lead <= 3) $leads[$phase] = $lead;
        }
    }
    return $leads;
}

function genesisAdviceScheduledFor(array $entry, array $phaseLeads): bool
{
    if (!isset($entry['schedule'])) return true;
    foreach ($entry['schedule']['phases'] as $phase) {
        if (in_array($phaseLeads[$phase] ?? null, $entry['schedule']['leadDays'], true)) return true;
    }
    return false;
}

/** Unseen posts lead; then the least recently viewed eligible post starts the next turn. */
function genesisAdviceTimeMatches(array $entry, int $hour): bool
{
    return match ($entry['timeOfDay'] ?? '') {
        'morning' => $hour >= 5 && $hour < 12,
        'evening' => $hour >= 18 || $hour < 5,
        default => true,
    };
}

function genesisAdviceClothing(array $entry): bool
{
    return array_intersect($entry['topics'] ?? [], ['clothing', 'attributes']) !== [];
}

function genesisAdviceDailyLimit(array $preferences, array $items): int
{
    $available = genesisAdviceAvailableCategories(array_values(array_filter($items,
        static fn($entry) => genesisAdviceAgeAllowed($entry, $preferences))));
    return min(6, max(3, count($preferences['smart'] ? $available : array_intersect($available, $preferences['categories']))));
}

/** Interest signals only: no gender, names, family profile or task text is sent or stored. */
function genesisAdviceFamilyAffinity(array $topics): float
{
    $parenting = $topics['parenting'] ?? 0;
    $sons = $topics['sons'] ?? 0;
    $fatherhood = $topics['fatherhood'] ?? 0;
    $motherhood = $topics['motherhood'] ?? 0;
    $interest = log(1 + $parenting + $sons + $fatherhood);
    if ($fatherhood > 0) $interest += 1.5;
    if ($sons > 0) $interest += 0.75;
    // Maternal interests keep access to the same collection, at a lower priority.
    if ($motherhood > 0 && $fatherhood <= 0) $interest = $interest * 0.3 - 1;
    return $interest;
}

function genesisAdviceAgeAllowed(array $entry, array $preferences): bool
{
    // Missing metadata in a historical Aphrodisia snapshot fails closed.
    return !in_array('aphrodisia', $entry['categories'], true)
        || (in_array('aphrodisia', $preferences['categories'], true) && ($preferences['aphrodisiaAdult'] ?? null) !== null
            && (($entry['requiresAdult'] ?? true) === false || $preferences['aphrodisiaAdult'] === true));
}

function genesisChooseAdvice(array $items, array $preferences, array $scores, array $history, string $seed,
    array $topicScores = [], ?array $phaseLeads = null, array $localContext = []): ?array
{
    $available = genesisAdviceAvailableCategories($items);
    $categories = $preferences['smart'] ? $available
        : array_values(array_intersect($available, $preferences['categories']));
    // Match the settings' effective selection when an older account selected only unpublished categories.
    if ($categories === []) $categories = $preferences['smart'] ? $available : array_slice($available, 0, 1);
    if (!in_array('aphrodisia', $preferences['categories'], true) || ($preferences['aphrodisiaAdult'] ?? null) === null) {
        $categories = array_values(array_diff($categories, ['aphrodisia']));
    }
    $phaseLeads ??= genesisAdvicePhaseLeads(genesisAdviceDayKey(), genesisAdviceTimeZone());
    $day = $localContext['day'] ?? genesisAdviceDayKey();
    $hour = $localContext['hour'] ?? (int)(new DateTimeImmutable('now', new DateTimeZone(genesisAdviceTimeZone())))->format('G');
    $excluded = $localContext['excluded'] ?? [];
    $eligible = array_values(array_filter($items, static fn($entry) => ($entry['status'] ?? 'published') !== 'draft'
        && genesisAdviceAgeAllowed($entry, $preferences)
        && !in_array($entry['id'], $excluded, true) && array_intersect($entry['categories'], $categories) !== []
        && genesisAdviceScheduledFor($entry, $phaseLeads)
        && (!$preferences['smart'] || genesisAdviceTimeMatches($entry, $hour))));
    if ($eligible === []) return null;
    $lastShown = []; $shownCounts = []; $exposures = []; $recentCategories = []; $recentTopics = [];
    foreach ($history as $index => $row) {
        $id = $row['advice_id'];
        $lastShown[$id] ??= $row['day_key'];
        $exposure = $id . ':' . $row['day_key'];
        if (!isset($exposures[$exposure])) { $shownCounts[$id] = ($shownCounts[$id] ?? 0) + 1; $exposures[$exposure] = true; }
        if ($index < 3) {
            $entry = json_decode($row['entry_json'], true, 32, JSON_THROW_ON_ERROR);
            foreach ($entry['categories'] as $category) $recentCategories[$category] = ($recentCategories[$category] ?? 0) + 1;
            foreach ($entry['topics'] ?? [] as $topic) $recentTopics[$topic] = ($recentTopics[$topic] ?? 0) + 1;
        }
    }
    // Clothes and personal attributes are a combined rare pool unless there is an explicit local interest.
    $clothingInterest = ($topicScores['clothing'] ?? 0) + ($topicScores['attributes'] ?? 0) > 0;
    if (!$clothingInterest) {
        $ordinaryUnseen = false;
        foreach ($items as $entry) if (($entry['status'] ?? 'published') !== 'draft'
            && in_array('hestiology', $entry['categories'], true) && !genesisAdviceClothing($entry)
            && !isset($lastShown[$entry['id']])) { $ordinaryUnseen = true; break; }
        $recentClothing = false;
        $cutoff = (new DateTimeImmutable($day))->modify('-30 days')->format('Y-m-d');
        $monthStart = substr($day, 0, 7) . '-01';
        foreach ($history as $row) if (($row['day_key'] > $cutoff || $row['day_key'] >= $monthStart)
            && genesisAdviceClothing(json_decode($row['entry_json'], true, 32, JSON_THROW_ON_ERROR))) { $recentClothing = true; break; }
        $previousClothing = isset($history[0]) && genesisAdviceClothing(json_decode($history[0]['entry_json'], true, 32, JSON_THROW_ON_ERROR));
        // Stable per account/day: refreshing or rotating cannot fish for a different probability.
        $rareDay = hexdec(substr(hash('sha256', ($localContext['user'] ?? $seed) . ':' . $day . ':clothing'), 0, 4)) % 4 === 0;
        if ($ordinaryUnseen || $recentClothing || $previousClothing || !$rareDay) {
            $eligible = array_values(array_filter($eligible, static fn($entry) => !genesisAdviceClothing($entry)));
        }
    }
    // Balance all three Aphrodisia meanings, rather than letting its larger love pool
    // overwhelm aesthetics and consciousness. Other categories retain their ranking.
    $themeCounts = ['love' => 0, 'aesthetics' => 0, 'consciousness' => 0];
    $previousTheme = null;
    foreach ($history as $row) {
        $theme = json_decode($row['entry_json'], true)['aphrodisiaTheme'] ?? null;
        if (isset($themeCounts[$theme ?? ''])) { $themeCounts[$theme]++; $previousTheme ??= $theme; }
    }
    $themes = array_values(array_unique(array_filter(array_column($eligible, 'aphrodisiaTheme'))));
    if ($themes !== []) {
        $minimum = min(array_map(static fn($theme) => $themeCounts[$theme], $themes));
        $eligible = array_values(array_filter($eligible, static fn($entry) => !isset($entry['aphrodisiaTheme'])
            || $themeCounts[$entry['aphrodisiaTheme']] === $minimum));
    }
    // Explicit Next alternates categories within the least-shown round, preserving no-repeat history.
    if ($eligible !== [] && ($localContext['previousCategories'] ?? []) !== []) {
        $minimum = min(array_map(static fn($entry) => $shownCounts[$entry['id']] ?? 0, $eligible));
        $round = array_values(array_filter($eligible, static fn($entry) => ($shownCounts[$entry['id']] ?? 0) === $minimum));
        $different = array_values(array_filter($round, static fn($entry) => array_diff($entry['categories'], $localContext['previousCategories']) !== []));
        $eligible = $different !== [] ? $different : $round;
    }
    // Within Aphrodisia, rotate love, aesthetics and consciousness, while retaining
    // no-repeat rounds. Intimate entries were removed before this balancing step.
    if ($previousTheme !== null && $eligible !== []) {
        $minimum = min(array_map(static fn($entry) => $shownCounts[$entry['id']] ?? 0, $eligible));
        $round = array_values(array_filter($eligible, static fn($entry) => ($shownCounts[$entry['id']] ?? 0) === $minimum));
        $different = array_values(array_filter($round, static fn($entry) => ($entry['aphrodisiaTheme'] ?? null) !== $previousTheme));
        if ($different !== []) $eligible = $different;
    }
    $best = null; $bestRank = null;
    foreach ($eligible as $entry) {
        $affinity = 0.0; $recent = 0;
        foreach (array_intersect($entry['categories'], $categories) as $category) {
            $affinity = max($affinity, $preferences['smart'] ? log(1 + ($scores[$category] ?? 0)) : 1.0);
            $recent = max($recent, $recentCategories[$category] ?? 0);
        }
        $topicAffinity = 0.0;
        foreach ($entry['topics'] ?? [] as $topic) {
            if ($preferences['smart'] || in_array($topic, ['clothing', 'attributes', 'cleaning', 'home_order'], true)) {
                $topicAffinity = max($topicAffinity, log(1 + ($topicScores[$topic] ?? 0)) / (1 + ($recentTopics[$topic] ?? 0)));
            }
        }
        if ($preferences['smart'] && in_array('kourotrophy', $entry['categories'], true)) {
            $affinity += genesisAdviceFamilyAffinity($topicScores);
        }
        // A completed round starts with the longest-unseen entries; context can never bypass history.
        // During a lunar window, eligible unseen preparations lead ordinary unseen posts.
        $rank = [$lastShown[$entry['id']] ?? '', -(int)isset($entry['schedule']), -($affinity / (1 + $recent) + $topicAffinity),
            -(int)($preferences['smart'] && isset($entry['timeOfDay'])), -(int)($entry['priority'] ?? false), hash('sha256', $seed . ':' . $entry['id'])];
        if ($bestRank === null || $rank < $bestRank) { $best = $entry; $bestRank = $rank; }
    }
    return $best;
}

function genesisAdviceForClient(array $row, string $language = 'ru'): array
{
    $entry = json_decode($row['entry_json'], true, 32, JSON_THROW_ON_ERROR);
    if (isset($entry['contentVersion'])) {
        $version = $entry['contentVersion'];
        if (!is_string($version) || !preg_match('/^[a-z0-9-]{1,80}$/D', $version)) throw new RuntimeException('INVALID_ADVICE_CONTENT');
        if (!in_array($language, GENESIS_ADVICE_LANGUAGES, true)) $language = 'ru';
        static $locales = [];
        $key = $version . ':' . $language;
        $locales[$key] ??= json_decode(file_get_contents(dirname(__DIR__) . '/content/daily-advice/' . $version . '/' . $language . '.json'), true, 32, JSON_THROW_ON_ERROR);
        $text = $locales[$key][$entry['id']] ?? null;
        if (!is_array($text) || !is_string($text['title'] ?? null) || !is_string($text['body'] ?? null)
            || trim($text['title']) === '' || trim($text['body']) === '') throw new RuntimeException('ADVICE_TRANSLATION_MISSING');
        $entry = [...$entry, ...$text, 'language' => $language];
    }
    unset($entry['contentVersion'], $entry['topics'], $entry['schedule'], $entry['status'], $entry['timeOfDay'], $entry['priority']);
    return [...$entry,
        'dayKey' => $row['day_key'], 'dismissed' => $row['dismissed_at'] !== null];
}

function genesisDailyAdvice(string $userId, array $payload, ?array $catalogFixture = null, bool $advance = false): array
{
    if (array_diff(array_keys($payload), ['scores', 'topics', 'fromId', 'dayKey'])) throw new InvalidArgumentException('INVALID_ADVICE_CONTEXT');
    if ($advance && (!is_string($payload['fromId'] ?? null) || !preg_match('/^advice-[a-f0-9]{24}$/D', $payload['fromId'])
        || !is_string($payload['dayKey'] ?? null) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $payload['dayKey']))) throw new InvalidArgumentException('INVALID_ADVICE_VIEW');
    $scores = genesisAdviceScores($payload['scores'] ?? []);
    $topics = genesisAdviceTopicScores($payload['topics'] ?? []);
    $day = genesisAdviceDayKey(); $db = genesisDb();
    genesisBeginWriteTransaction($db);
    try {
        $user = genesisFindUser($userId);
        if ($user === null) throw new DomainException('AUTH_REQUIRED');
        $preferences = genesisAdvicePreferences($user['advice_preferences_json'] ?? '{}');
        $result = ['dayKey' => $day, 'advice' => null, 'state' => 'disabled', 'sequence' => 0, 'dailyLimit' => 3, 'remaining' => 0, 'canNext' => false];
        if ($preferences['enabled']) {
            $items = $catalogFixture ?? genesisAdviceCatalog();
            $query = $db->prepare('SELECT * FROM daily_advice_days WHERE user_id = ? AND day_key = ?');
            $query->execute([$userId, $day]); $row = $query->fetch();
            $drawPreferences = is_array($row) ? genesisAdvicePreferences($row['selection_json']) : $preferences;
            // Safety choice is current, even when today's selection preferences are frozen.
            $drawPreferences['aphrodisiaAdult'] = $preferences['aphrodisiaAdult'];
            $slots = $db->prepare('SELECT advice_id FROM daily_advice_entries WHERE user_id=? AND day_key=? ORDER BY slot');
            $slots->execute([$userId, $day]); $todayIds = $slots->fetchAll(PDO::FETCH_COLUMN);
            $limit = is_array($row) ? (int)$row['draw_limit'] : genesisAdviceDailyLimit($drawPreferences, $items);
            $history = $db->prepare('SELECT advice_id,day_key,entry_json FROM daily_advice_entries WHERE user_id=? AND viewed_at IS NOT NULL ORDER BY day_key DESC,slot DESC');
            $history->execute([$userId]); $viewed = $history->fetchAll();
            $local = ['day' => $day, 'hour' => (int)(new DateTimeImmutable('now', new DateTimeZone(genesisAdviceTimeZone())))->format('G'), 'excluded' => $todayIds, 'user' => $userId];
            $oldEntry = is_array($row) ? json_decode($row['entry_json'], true, 32, JSON_THROW_ON_ERROR) : null;
            $ageBlocked = is_array($oldEntry) && !genesisAdviceAgeAllowed($oldEntry, $preferences);
            $timeChanged = is_array($oldEntry) && $drawPreferences['smart'] && !genesisAdviceTimeMatches($oldEntry, $local['hour']);
            $requestedNext = $advance && is_array($row) && $payload['fromId'] === $row['advice_id'] && $payload['dayKey'] === $day;
            if ($requestedNext) $local['previousCategories'] = $oldEntry['categories'];
            if (!is_array($row) || (($requestedNext || $timeChanged || $ageBlocked) && ($row['dismissed_at'] === null || $ageBlocked) && count($todayIds) < $limit)) {
                // The optional fixture is used only by isolated backend tests, never by HTTP input.
                if ($requestedNext) {
                    foreach (['daily_advice_days', 'daily_advice_entries'] as $table) {
                        $db->prepare("UPDATE $table SET viewed_at=COALESCE(viewed_at,?) WHERE user_id=? AND day_key=? AND advice_id=?")
                            ->execute([genesisNow(), $userId, $day, $row['advice_id']]);
                    }
                    array_unshift($viewed, ['advice_id' => $row['advice_id'], 'day_key' => $day, 'entry_json' => $row['entry_json']]);
                }
                $entry = genesisChooseAdvice($items, $drawPreferences, $scores, $viewed, $userId . ':' . $day . ':' . count($todayIds), $topics, null, $local);
                if ($entry !== null) {
                    $row = ['day_key' => $day, 'advice_id' => $entry['id'], 'entry_json' => json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'dismissed_at' => null, 'draw_limit' => $limit];
                    $db->prepare('INSERT INTO daily_advice_entries(user_id,day_key,slot,advice_id,entry_json,created_at) VALUES (?,?,?,?,?,?)')
                        ->execute([$userId, $day, count($todayIds) + 1, $entry['id'], $row['entry_json'], genesisNow()]);
                    $db->prepare('INSERT INTO daily_advice_days(user_id,day_key,advice_id,entry_json,created_at,draw_limit,selection_json) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,day_key) DO UPDATE SET advice_id=excluded.advice_id,entry_json=excluded.entry_json,created_at=excluded.created_at,viewed_at=NULL,dismissed_at=NULL')
                        ->execute([$userId, $day, $entry['id'], $row['entry_json'], genesisNow(), $limit, json_encode($drawPreferences, JSON_THROW_ON_ERROR)]);
                    $todayIds[] = $entry['id']; $local['excluded'] = $todayIds; $timeChanged = false; $ageBlocked = false;
                }
            }
            $result['state'] = $items === [] ? 'empty' : 'no-match';
            $result['sequence'] = count($todayIds); $result['dailyLimit'] = $limit;
            $result['remaining'] = max(0, $limit - count($todayIds));
            if (is_array($row) && !$timeChanged && !$ageBlocked) {
                $result['advice'] = genesisAdviceForClient($row, $user['language'] ?? 'ru'); $result['state'] = 'ready';
                $result['canNext'] = $row['dismissed_at'] === null && $result['remaining'] > 0
                    && genesisChooseAdvice($items, $drawPreferences, $scores, $viewed, $userId . ':' . $day, $topics, null, $local) !== null;
            }
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
    foreach (['daily_advice_days', 'daily_advice_entries'] as $table) {
        $query = genesisDb()->prepare("UPDATE $table SET $sql WHERE user_id = :user AND day_key = :day AND advice_id = :id");
        $query->execute(['now' => genesisNow(), 'user' => $userId, 'day' => $day, 'id' => $id]);
    }
    return ['ok' => true];
}
