<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || getenv('GENESIS_MINDMAPS_TEST') !== 'isolated') {
    fwrite(STDERR, "Explicit isolated test environment required.\n"); exit(1);
}
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/repository.php';
require __DIR__ . '/../src/shared-projects.php';
require __DIR__ . '/../src/mindmaps.php';
function mapExpect(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
$testRoot = realpath(__DIR__ . '/../../output');
$dbPath = realpath((string)genesisConfig()['db_path']);
if (!$testRoot || !$dbPath || !str_starts_with(str_replace('\\', '/', $dbPath), str_replace('\\', '/', $testRoot) . '/') || basename($dbPath) !== 'mindmaps-test.sqlite') {
    throw new RuntimeException('This suite requires output/mindmaps-test.sqlite; refusing any other database.');
}
$db=genesisDb();
$ids=['mindmaps-test-owner-a','mindmaps-test-owner-b'];
foreach($ids as $id) $db->prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES(?,?,?,?,?)')->execute([$id,$id,$id.'@example.invalid',genesisNow(),genesisNow()]);
try {
 $payload=['schemaVersion'=>1,'expectedRevision'=>0,'operationId'=>'first','iv'=>base64_encode(random_bytes(12)),'ciphertext'=>base64_encode(random_bytes(64))];
 $saved=genesisSaveMindmap($ids[0],'map-one',$payload);mapExpect($saved['revision']===1,'Creation revision');
 mapExpect(genesisSaveMindmap($ids[0],'map-one',$payload)['revision']===1,'Lost-response retry created a revision');
 mapExpect(genesisMindmaps($ids[1])===[] && genesisMindmapHistory($ids[1],'map-one')===[],'Second account read first account');
 try {genesisSaveMindmap($ids[1],'map-one',[...$payload,'expectedRevision'=>1]);throw new RuntimeException('Foreign revision accepted');}catch(GenesisResourceLimitException $e){mapExpect($e->status===409,'Wrong owner conflict status');}
 try {genesisSaveMindmap($ids[0],'map-one',[...$payload,'operationId'=>'stale']);throw new RuntimeException('Stale revision accepted');}catch(GenesisResourceLimitException $e){mapExpect($e->getMessage()==='MAP_REVISION_CONFLICT','Wrong conflict');}
 foreach([['schemaVersion'=>2],['iv'=>'bad'],['ciphertext'=>'plaintext title'],['expectedRevision'=>-1]] as $invalid){try{genesisSaveMindmap($ids[0],'bad',[...$payload,...$invalid]);throw new RuntimeException('Invalid envelope accepted');}catch(InvalidArgumentException $expected){}}
 for($i=1;$i<=24;$i++) genesisSaveMindmap($ids[0],'map-one',[...$payload,'expectedRevision'=>$i,'operationId'=>'operation-'.$i]);
 mapExpect(count(genesisMindmapHistory($ids[0],'map-one'))===20,'History retention');
 $before=genesisMindmaps($ids[0]);
 $db->prepare('INSERT INTO workspace_blobs(user_id,ciphertext,iv,version,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET ciphertext=excluded.ciphertext')->execute([$ids[0],base64_encode('old-client-workspace'),base64_encode(random_bytes(12)),1,genesisNow()]);
 mapExpect(genesisMindmaps($ids[0])===$before,'Old workspace erased maps');
 // A receipt is retained even after its snapshot leaves the 20-version window.
 mapExpect(genesisSaveMindmap($ids[0],'map-one',$payload)['revision']===1,'Old receipt lost');
 // A near-full history can rotate; an actual increase beyond the quota cannot.
 $large=[...$payload,'ciphertext'=>str_repeat('A',1_995_000)];
 for($i=0;$i<21;$i++) genesisSaveMindmap($ids[0],'large',[...$large,'expectedRevision'=>$i,'operationId'=>'large-'.$i]);
 mapExpect(count(genesisMindmapHistory($ids[0],'large'))===20,'Near-quota retention did not rotate');
 try {genesisSaveMindmap($ids[0],'over-quota',[...$payload,'ciphertext'=>str_repeat('A',200_000)]);throw new RuntimeException('Quota increase accepted');}
 catch(GenesisResourceLimitException $e){mapExpect($e->status===413 && $e->getMessage()==='MAP_STORAGE_LIMIT','Wrong quota rejection');}
 echo "PASS: envelope validation, account isolation, CAS, retry receipt, 20-version retention, quota rotation, old-workspace compatibility\n";
} finally { foreach($ids as $id) $db->prepare('DELETE FROM users WHERE id=?')->execute([$id]); }
