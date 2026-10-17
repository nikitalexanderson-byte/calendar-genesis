$ErrorActionPreference='Stop'
$pushSetupPhp=@'
<?php
declare(strict_types=1);
$root='/home/u531952483/domains/genesiscalendar.com';
if(realpath($root)!==$root||!is_file($root.'/server/src/habit-reminders.php')){fwrite(STDERR,"Deploy habit reminders before runtime setup.\n");exit(2);}
$path=$root.'/server/config.php';$directory=$root.'/server/var/runtime-backups';
if(!is_dir($directory)&&!mkdir($directory,0700,true))throw new RuntimeException('Cannot create private runtime backup directory.');
$lock=fopen($directory.'/web-push-setup.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Cannot lock runtime setup.');
try{
    $config=require $path;
    if(!is_array($config)||parse_url($config['app_url']??'',PHP_URL_HOST)!=='genesiscalendar.com')throw new RuntimeException('Unexpected runtime origin.');
    if(!extension_loaded('openssl')||!extension_loaded('curl')||!function_exists('openssl_pkey_derive'))throw new RuntimeException('Required Web Push runtime unavailable.');
    $existing=$config['notifications']['web_push']['private_key']??null;$created=false;
    if(is_string($existing)&&trim($existing)!==''){
        $key=openssl_pkey_get_private($existing);$details=$key?openssl_pkey_get_details($key):false;
        if(!$details||($details['ec']['curve_name']??'')!=='prime256v1')throw new RuntimeException('Existing Web Push key is invalid; it was preserved.');
    }else{
        $key=openssl_pkey_new(['private_key_type'=>OPENSSL_KEYTYPE_EC,'curve_name'=>'prime256v1']);$private='';
        if(!$key||!openssl_pkey_export($key,$private))throw new RuntimeException('Cannot create Web Push key.');
        $config['notifications']['web_push']=['private_key'=>$private,'subject'=>'mailto:noreply@genesiscalendar.com'];
        $backup=$directory.'/config-web-push-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(3)).'.php';
        if(!copy($path,$backup))throw new RuntimeException('Cannot preserve previous runtime configuration.');chmod($backup,0600);
        $temporary=$root.'/server/config.web-push-next-'.bin2hex(random_bytes(4)).'.php';
        try{
            if(file_put_contents($temporary,"<?php\nreturn ".var_export($config,true).";\n",LOCK_EX)===false)throw new RuntimeException('Cannot stage Web Push configuration.');
            chmod($temporary,0600);$check=require $temporary;
            if(!is_array($check)||($check['notifications']['web_push']??null)!==$config['notifications']['web_push'])throw new RuntimeException('Runtime verification failed.');
            if(!rename($temporary,$path))throw new RuntimeException('Cannot apply runtime configuration.');$created=true;
        }finally{if(is_file($temporary))unlink($temporary);}
    }
    require $root.'/server/src/bootstrap.php';require $root.'/server/src/web-push.php';$readiness=genesisPushConfiguration();
    if(empty($readiness['available']))throw new RuntimeException('Web Push readiness verification failed.');
    echo json_encode(['ok'=>true,'created'=>$created,'available'=>true,'keyFingerprint'=>hash('sha256',$readiness['publicKey']),
        'externalMessagesSent'=>false,'databaseModified'=>false]),PHP_EOL;
}finally{flock($lock,LOCK_UN);fclose($lock);}
'@
$pushSetupKey=Join-Path $env:USERPROFILE '.ssh/id_ed25519_genesis_hostinger'
$pushSetupPhp | ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -p 65002 -i $pushSetupKey u531952483@82.198.232.224 php
if($LASTEXITCODE -ne 0){throw 'Web Push runtime configuration was not confirmed.'}
