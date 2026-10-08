<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/ads.php';

$release = ['versionName' => '2.7.0', 'minimumSupportedVersionName' => '2.7.0'];
$notice = genesisAndroidSupportNotice('ru', '2.6.9', $release);
if ($notice === null || $notice['linkUrl'] !== 'https://genesiscalendar.com/api/android/download')
    throw new RuntimeException('Older installed clients must receive the current release notice.');
foreach (['2.7.0', '2.8.0', '', 'unknown', '../2.6.9'] as $version) {
    if (genesisAndroidSupportNotice('ru', $version, $release) !== null)
        throw new RuntimeException('Supported, web or malformed clients must not receive a support notice.');
}
if (genesisAndroidSupportNotice('en', '2.6.9', null) !== null
    || genesisAndroidSupportNotice('en', '2.6.9', ['versionName' => '2.6.9', 'minimumSupportedVersionName' => '2.7.0']) !== null)
    throw new RuntimeException('Never require an unpublished release.');
echo "Android support notice tests passed.\n";
