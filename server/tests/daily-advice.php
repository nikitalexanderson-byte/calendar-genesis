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
$manual = ['enabled' => true, 'smart' => false, 'categories' => ['aretology']];
adviceExpect(genesisChooseAdvice($items, $manual, $scores, [], 'manual')['id'] === $items[2]['id'], 'Manual categories ignored');
adviceExpect(genesisChooseAdvice($items, $preferences, genesisAdviceScores(['aretology' => 1]), [], 'smart')['id'] === $items[2]['id'], 'Smart categories ignored');
adviceExpect(genesisChooseAdvice($items, ['enabled' => true, 'smart' => false, 'categories' => ['kourotrophy']], $scores, [], 'empty') === null, 'Unselected content leaked into the pool');
adviceExpect(genesisChooseAdvice($items, $preferences, genesisAdviceScores([]), [], 'fallback') !== null, 'No-habit fallback failed');

$db = genesisDb(); $ids = [];
for ($index = 0; $index < 2; $index++) {
    $id = 'advice-test-' . bin2hex(random_bytes(8)); $ids[] = $id;
    $db->prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES (?,?,?,?,?)')->execute([$id, $id, $id . '@example.invalid', genesisNow(), genesisNow()]);
}
try {
    [$alice, $bob] = $ids;
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
