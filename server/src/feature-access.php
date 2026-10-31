<?php
declare(strict_types=1);

/** Server-owned policy. This release deliberately grants every feature to every plan. */
function genesisFeatureAccessPolicy(): array
{
    static $policy;
    return $policy ??= json_decode((string)file_get_contents(dirname(__DIR__) . '/resources/feature-access-policy.json'), true, 32, JSON_THROW_ON_ERROR);
}

/** Strict seconds-precision ISO timestamp. Never normalize an invalid date into paid time. */
function genesisSubscriptionExpiry(mixed $value): int|false
{
    if (!is_string($value) || preg_match('/\A(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-](\d{2}):(\d{2}))\z/D', $value, $parts) !== 1) return false;
    if (!checkdate((int)$parts[2], (int)$parts[3], (int)$parts[1])
        || (int)$parts[4] > 23 || (int)$parts[5] > 59 || (int)$parts[6] > 59) return false;
    // Match java.time's maximum zone offset. At eighteen hours no minutes remain.
    if (isset($parts[8]) && ((int)$parts[8] > 18 || (int)$parts[9] > 59
        || ((int)$parts[8] === 18 && (int)$parts[9] !== 0))) return false;
    return strtotime($value);
}

/** Pure resolver: callers must pass a database user, never request/profile/import fields. */
function genesisResolveFeatureAccess(array $user, array $policy, int $now): array
{
    $plans = ['free', 'standart', 'premium', 'business', 'premium4life'];
    $declared = in_array($user['subscription_plan'] ?? null, $plans, true) ? $user['subscription_plan'] : 'free';
    $lifetime = $declared === 'premium4life';
    $expiry = genesisSubscriptionExpiry($user['subscription_valid_until'] ?? null);
    // Legacy administrative plan labels alone are not verified payment evidence.
    $effective = $lifetime ? 'premium' : ($declared !== 'free' && $expiry !== false && $expiry > $now ? $declared : 'free');
    $enabled = ($policy['enforcementEnabled'] ?? false) === true;
    $features = $policy['features'] ?? [];
    $allowed = [];
    foreach ($features as $feature => $availablePlans) {
        if (!$enabled || in_array($effective, $availablePlans, true)) $allowed[] = $feature;
    }
    return [
        'schemaVersion' => 1,
        'policyRevision' => (string)$policy['revision'],
        'enforcementEnabled' => $enabled,
        'declaredPlan' => $declared,
        'effectivePlan' => $effective,
        'lifetimePremium' => $lifetime,
        'validUntil' => !$lifetime && $expiry !== false ? gmdate('Y-m-d\TH:i:s\Z', $expiry) : null,
        'evaluatedAt' => gmdate('Y-m-d\TH:i:s\Z', $now),
        'allowedFeatures' => $allowed,
        // Clients can re-evaluate expiry while open without trusting a local plan selector.
        'freeFeatures' => array_keys(array_filter($features, static fn(array $values): bool => in_array('free', $values, true))),
    ];
}

function genesisFeatureAccessForUser(array $user): array
{
    return genesisResolveFeatureAccess($user, genesisFeatureAccessPolicy(), time());
}

/** Future API mutations use this in addition to their existing owner/role/CSRF checks. */
function genesisRequireFeature(string $userId, string $feature): void
{
    $user = genesisFindUser($userId);
    if ($user === null) genesisJson(['error' => 'UNAUTHORIZED'], 401);
    $access = genesisFeatureAccessForUser($user);
    if ($access['enforcementEnabled'] && !in_array($feature, $access['allowedFeatures'], true)) {
        genesisJson(['error' => 'FEATURE_SUBSCRIPTION_REQUIRED', 'feature' => $feature], 403);
    }
}
