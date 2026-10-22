<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/repository.php';
require dirname(__DIR__) . '/src/google.php';
require dirname(__DIR__) . '/src/shared-projects.php';

function adviceExpect(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function adviceReject(callable $action): void {
    try { $action(); } catch (InvalidArgumentException) { return; }
    throw new RuntimeException('Invalid advice input was accepted');
}
function adviceFixture(string $name, string $category): array {
    return ['id' => 'advice-' . substr(hash('sha256', $name), 0, 24), 'body' => 'Isolated test: ' . $name,
        'language' => 'en', 'categories' => [$category], 'sources' => []];
}
$migration = dirname(__DIR__) . '/migrations/080_daily_advice.sql';
$legacy = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
foreach (glob(dirname(__DIR__) . '/migrations/*.sql') as $file) {
    if (strcmp(basename($file), basename($migration)) < 0) $legacy->exec(file_get_contents($file));
}
$legacy->exec("INSERT INTO users(id,google_sub,email,created_at,updated_at,calendar_mode) VALUES ('advice-legacy','advice-legacy','legacy@example.invalid','now','now','lunar')");
$backupPath = tempnam(sys_get_temp_dir(), 'genesis-advice-80-');
try {
    $legacy->exec('VACUUM INTO ' . $legacy->quote($backupPath));
    $legacy->beginTransaction(); $legacy->exec(file_get_contents($migration)); $legacy->commit();
    adviceExpect($legacy->query("SELECT calendar_mode FROM users WHERE id='advice-legacy'")->fetchColumn() === 'lunar', 'Migration changed legacy data');
    $legacy->exec("UPDATE users SET calendar_mode='sacred' WHERE id='advice-legacy'");
    adviceExpect($legacy->query("SELECT advice_preferences_json FROM users WHERE id='advice-legacy'")->fetchColumn() === '{}', 'Incompatible migration defaults');
    $backup = new PDO('sqlite:' . $backupPath);
    adviceExpect($backup->query('PRAGMA integrity_check')->fetchColumn() === 'ok', 'Inconsistent migration backup');
    adviceExpect($backup->query("SELECT calendar_mode FROM users WHERE id='advice-legacy'")->fetchColumn() === 'lunar', 'Backup lost original data');
    adviceExpect(!in_array('advice_preferences_json', array_column($backup->query('PRAGMA table_info(users)')->fetchAll(PDO::FETCH_ASSOC), 'name'), true), 'Backup includes post-migration schema');
} finally { $backup = null; if (is_file($backupPath)) unlink($backupPath); }

$preferences = genesisAdvicePreferences([]);
adviceExpect($preferences['enabled'] && $preferences['smart'] && count($preferences['categories']) === 6, 'Wrong defaults');
foreach ([['enabled' => 'false'], ['smart' => false, 'categories' => []], ['categories' => ['unknown']], ['unknown' => true]] as $input) adviceReject(fn() => genesisAdvicePreferences($input));
foreach ([['hermetica' => -1], ['hermetica' => '1'], ['hermetica' => 1001], ['habitTitles' => []]] as $input) adviceReject(fn() => genesisAdviceScores($input));

$items = [adviceFixture('A', 'hermetica'), adviceFixture('B', 'hermetica'), adviceFixture('C', 'aretology')];
$scores = genesisAdviceScores(['hermetica' => 10, 'aretology' => 1]);
$history = [];
for ($day = 1; $day <= 9; $day++) {
    $chosen = genesisChooseAdvice($items, $preferences, $scores, $history, 'user:' . $day);
    array_unshift($history, ['advice_id' => $chosen['id'], 'day_key' => sprintf('2026-10-%02d', $day), 'entry_json' => json_encode($chosen)]);
    if ($day % 3 === 0) adviceExpect(count(array_unique(array_column(array_slice($history, 0, 3), 'advice_id'))) === 3, 'Repeated before the selected pool was exhausted');
}
$newItem = adviceFixture('newly added', 'hermetica');
adviceExpect(genesisChooseAdvice([...$items, $newItem], $preferences, $scores, $history, 'new')['id'] === $newItem['id'], 'New content did not take priority over repeats');
array_unshift($history, ['advice_id' => $newItem['id'], 'day_key' => '2026-10-10', 'entry_json' => json_encode($newItem)]);
adviceExpect(genesisChooseAdvice([...$items, $newItem], $preferences, $scores, $history, 'after-new')['id'] !== $newItem['id'],
    'A newly read post repeated while catching up with older exposure counts');
$manual = ['enabled' => true, 'smart' => false, 'categories' => ['aretology']];
adviceExpect(genesisChooseAdvice($items, $manual, $scores, [], 'manual')['id'] === $items[2]['id'], 'Manual categories ignored');
adviceExpect(genesisChooseAdvice($items, $preferences, genesisAdviceScores(['aretology' => 1]), [], 'smart')['id'] === $items[2]['id'], 'Smart categories ignored');
adviceExpect(genesisChooseAdvice([], $manual, $scores, [], 'empty') === null, 'Empty corpus produced a fallback');
adviceExpect(genesisChooseAdvice($items, ['enabled' => true, 'smart' => false, 'categories' => ['kourotrophy']], $scores, [], 'legacy-manual')['id'] === $items[2]['id'], 'Unavailable manual selection disagreed with the settings fallback');
adviceExpect(in_array(genesisChooseAdvice($items, ['enabled' => true, 'smart' => false, 'categories' => ['hermetica', 'kourotrophy']], $scores, [], 'mixed-manual')['id'], [$items[0]['id'], $items[1]['id']], true), 'Available manual choices were replaced by fallback content');
adviceExpect(genesisChooseAdvice($items, $preferences, genesisAdviceScores([]), [], 'fallback') !== null, 'No-habit fallback failed');

// A habit in an unpublished category falls back to available content.
adviceExpect(genesisChooseAdvice([$items[2]], $preferences, genesisAdviceScores(['hermetica' => 100]), [], 'available')['id'] === $items[2]['id'], 'Unavailable smart category suppressed available advice');
$food = [...adviceFixture('food', 'aretology'), 'topics' => ['nutrition']];
$workout = [...adviceFixture('workout', 'aretology'), 'topics' => ['training']];
$topicScores = genesisAdviceTopicScores(['nutrition' => 100]);
adviceExpect(genesisChooseAdvice([$food, $workout], $preferences, $scores, [], 'food', $topicScores, [])['id'] === $food['id'], 'Food habits did not favour food content');
$foodHistory = [['advice_id' => $food['id'], 'day_key' => '2026-10-01', 'entry_json' => json_encode($food)]];
adviceExpect(genesisChooseAdvice([$food, $workout], $preferences, $scores, $foodHistory, 'food-repeat', $topicScores, [])['id'] === $workout['id'], 'Food affinity bypassed unseen history');
adviceReject(fn() => genesisAdviceTopicScores(['nutrition' => 'high']));
adviceReject(fn() => genesisAdviceTopicScores(['habitNames' => ['Private text']]));
$lunar = [...adviceFixture('lunar preparation', 'aretology'), 'schedule' => ['phases' => ['new', 'full'], 'leadDays' => [1, 2, 3]]];
adviceExpect(genesisChooseAdvice([$food, $lunar], $manual, $scores, [], 'not-lunar', [], [])['id'] === $food['id'], 'Lunar preparation leaked outside its window');
foreach (['new', 'full'] as $phase) foreach ([1, 2, 3] as $lead) {
    adviceExpect(genesisChooseAdvice([$food, $lunar], $manual, $scores, [], 'lunar', [], [$phase => $lead])['id'] === $lunar['id'], 'Lunar preparation did not lead during its window');
}
foreach ([0, 4] as $lead) adviceExpect(!genesisAdviceScheduledFor($lunar, ['new' => $lead]), 'Wrong lunar boundary');
adviceExpect(genesisChooseAdvice([[...$food, 'status' => 'draft']], $manual, $scores, [], 'draft') === null, 'Private draft entered the selection pool');
$ephemeris = genesisCalendarEphemeris();
foreach (['Europe/Moscow', 'Pacific/Kiritimati', 'America/Los_Angeles', 'Europe/Berlin'] as $zone) {
    foreach (['new' => 'newMoons', 'full' => 'fullMoons'] as $phase => $key) {
        $moment = array_values(array_filter($ephemeris[$key], static fn($moment) => $moment >= 1767225600000 && $moment < 1798761600000))[0];
        $eventDay = genesisCalendarEventDate($moment, ['timeZone' => $zone]);
        foreach ([1, 2, 3] as $lead) {
            $before = genesisCalendarAddDays($eventDay, -$lead);
            adviceExpect((genesisAdvicePhaseLeads($before, $zone)[$phase] ?? null) === $lead, 'Lunar window ignored local civil date');
        }
        foreach ([0, 1, -4] as $offset) adviceExpect(!isset(genesisAdvicePhaseLeads(genesisCalendarAddDays($eventDay, $offset), $zone)[$phase]), 'Lunar advice appeared on or after the phase or too early');
    }
}
adviceExpect(genesisAdviceAvailableCategories() === ['aretology'], 'Unpublished categories became clickable');

$db = genesisDb(); $ids = [];
for ($index = 0; $index < 2; $index++) {
    $id = 'advice-test-' . bin2hex(random_bytes(8)); $ids[] = $id;
    $db->prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES (?,?,?,?,?)')->execute([$id, $id, $id . '@example.invalid', genesisNow(), genesisNow()]);
}
try {
    [$alice, $bob] = $ids;
    genesisUpdateAccountPreferences($bob, ['advicePreferences' => ['smart' => false, 'categories' => ['hermetica']]]);
    $legacyFallback = genesisDailyAdvice($bob, []);
    adviceExpect($legacyFallback['state'] === 'ready' && $legacyFallback['advice']['categories'] === ['aretology'], 'Saved unavailable manual category suppressed the displayed Aretology selection');
    adviceExpect(genesisAdvicePreferences(genesisFindUser($bob)['advice_preferences_json'])['categories'] === ['hermetica'], 'Reading advice unexpectedly rewrote legacy preferences');
    genesisUpdateAccountPreferences($alice, ['advicePreferences' => ['smart' => false, 'categories' => ['hermetica']]]);
    genesisUpdateAccountPreferences($alice, ['stoicheionDivinationDisabled' => true, 'uiVisibility' => ['sacredFeaturesEnabled' => false]]);
    $saved = genesisAdvicePreferences(genesisFindUser($alice)['advice_preferences_json']);
    adviceExpect($saved['enabled'] && !$saved['smart'] && $saved['categories'] === ['hermetica'], 'Sacred or legacy settings reset advice');
    $empty = genesisDailyAdvice($alice, [], []);
    adviceExpect($empty['state'] === 'empty' && $empty['advice'] === null, 'Empty corpus produced a card');
    $result = genesisDailyAdvice($alice, ['scores' => $scores], $items);
    $card = $result['advice'];
    adviceExpect($card !== null && !$card['dismissed'], 'Daily reservation failed');
    for ($i = 0; $i < 4; $i++) adviceExpect(genesisDailyAdvice($alice, ['scores' => ['aretology' => 100]], [$items[2]])['advice']['id'] === $card['id'], 'Parallel replay changed the daily advice');
    adviceExpect((int)$db->query("SELECT COUNT(*) FROM daily_advice_days WHERE user_id=" . $db->quote($alice))->fetchColumn() === 1, 'Daily reservation was duplicated');
    $seen = $db->prepare('SELECT viewed_at,dismissed_at FROM daily_advice_days WHERE user_id=?'); $seen->execute([$alice]);
    adviceExpect($seen->fetch()['viewed_at'] === null, 'Fetching consumed an unseen advice');
    genesisRecordAdvice($bob, $card, true);
    adviceExpect(!genesisDailyAdvice($alice, [], $items)['advice']['dismissed'], 'Another account dismissed a card');
    genesisRecordAdvice($alice, $card, false); genesisRecordAdvice($alice, $card, false);
    genesisRecordAdvice($alice, $card, true); genesisRecordAdvice($alice, $card, true);
    adviceExpect(genesisDailyAdvice($alice, [], $items)['advice']['dismissed'], 'Dismissal did not persist');
    $seen->execute([$alice]); $row = $seen->fetch();
    adviceExpect($row['viewed_at'] !== null && $row['dismissed_at'] !== null, 'Visible/dismissed history was not stored');
    genesisUpdateAccountPreferences($alice, ['advicePreferences' => ['enabled' => false]]);
    adviceExpect(genesisDailyAdvice($alice, [], $items)['advice'] === null, 'Disabled advice still returned content');
    genesisUpdateAccountPreferences($alice, ['advicePreferences' => ['enabled' => true]]);
    adviceExpect(genesisDailyAdvice($alice, [], $items)['advice']['id'] === $card['id'], 'Re-enabling rerolled the day');
    foreach ([genesisAdviceCatalog()[0], genesisAdviceCatalog()[25]] as $versioned) {
        $localizedRow = ['day_key' => $card['dayKey'], 'entry_json' => json_encode($versioned, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'dismissed_at' => genesisNow()];
        foreach (GENESIS_ADVICE_LANGUAGES as $language) {
            $localized = genesisAdviceForClient($localizedRow, $language);
            $expected = json_decode(file_get_contents(__DIR__ . '/../content/daily-advice/' . $versioned['contentVersion'] . '/' . $language . '.json'), true, 32, JSON_THROW_ON_ERROR)[$versioned['id']];
            adviceExpect($localized['id'] === $versioned['id'] && $localized['dismissed'] && $localized['dayKey'] === $card['dayKey'], 'Changing language changed identity or dismissal');
            adviceExpect($localized['language'] === $language && $localized['title'] === $expected['title'] && $localized['body'] === $expected['body'], 'Incomplete or wrong daily advice translation');
            adviceExpect(array_intersect(['contentVersion', 'topics', 'schedule', 'status'], array_keys($localized)) === [], 'Internal publishing metadata leaked');
        }
    }
    $db->prepare('UPDATE daily_advice_days SET advice_id=?,entry_json=? WHERE user_id=?')->execute([$versioned['id'], $localizedRow['entry_json'], $alice]);
    foreach (GENESIS_ADVICE_LANGUAGES as $language) {
        genesisUpdateAccountPreferences($alice, ['language' => $language]);
        $translatedDay = genesisDailyAdvice($alice, [], $items)['advice'];
        adviceExpect($translatedDay['id'] === $versioned['id'] && $translatedDay['language'] === $language && $translatedDay['dismissed'], 'Daily replay ignored account language or rerolled the post');
    }
    $db->prepare('DELETE FROM users WHERE id=?')->execute([$alice]);
    adviceExpect((int)$db->query("SELECT COUNT(*) FROM daily_advice_days WHERE user_id=" . $db->quote($alice))->fetchColumn() === 0, 'Account removal retained advice history');
    $_SERVER['HTTP_X_GENESIS_TIME_ZONE'] = 'Pacific/Kiritimati';
    adviceExpect(genesisAdviceDayKey() === (new DateTimeImmutable('now', new DateTimeZone('Pacific/Kiritimati')))->format('Y-m-d'), 'Server ignored the device day');
    $_SERVER['HTTP_X_GENESIS_TIME_ZONE'] = 'invalid';
    adviceExpect(genesisAdviceDayKey() === (new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow')))->format('Y-m-d'), 'Invalid time zone had no safe fallback');
    echo "Daily advice: backup, additive rollback, preferences, empty corpus, ranking cycles, new content, manual/smart selection, daily replay, view acknowledgement, account isolation, dismissal and cascade passed.\n";
} finally {
    foreach ($ids as $id) $db->prepare('DELETE FROM users WHERE id=?')->execute([$id]);
}
