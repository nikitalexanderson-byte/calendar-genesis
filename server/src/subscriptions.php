<?php
declare(strict_types=1);

const GENESIS_SUBSCRIPTION_PLANS = ['free', 'standart', 'premium', 'business', 'premium4life'];

// Primary-admin assignment only. Premium4Life is a permanent Premium grant;
// ordinary plan labels are metadata until a verified expiry is recorded.
// Feature enforcement remains disabled in the 3.1.3 policy. Plans never grant roles.
function genesisAdminSetSubscription(string $actorId, string $targetId, string $plan, string $expectedPlan): array
{
    $actor = genesisFindUser($actorId) ?? [];
    genesisRequireAdmin($actor);
    // Linked identities can open the owner's workspace, but cannot issue permanent grants.
    if (!genesisSessionIsPrimaryGoogleUser($actor)) genesisJson(['error' => 'FORBIDDEN'], 403);
    if (!in_array($plan, GENESIS_SUBSCRIPTION_PLANS, true)
        || !in_array($expectedPlan, GENESIS_SUBSCRIPTION_PLANS, true)) {
        throw new InvalidArgumentException('INVALID_SUBSCRIPTION_PLAN');
    }
    $target = genesisFindUser($targetId);
    if ($target === null) throw new DomainException('SUBSCRIPTION_USER_NOT_FOUND');
    if ($target['subscription_plan'] !== $expectedPlan) throw new DomainException('SUBSCRIPTION_STATUS_CONFLICT');
    $update = genesisDb()->prepare('UPDATE users SET subscription_plan = :plan, updated_at = :updated_at WHERE id = :id AND subscription_plan = :expected_plan');
    $update->execute(['plan' => $plan, 'updated_at' => genesisNow(), 'id' => $targetId, 'expected_plan' => $expectedPlan]);
    if ($update->rowCount() !== 1) throw new DomainException('SUBSCRIPTION_STATUS_CONFLICT');
    return ['userId' => $targetId, 'subscriptionPlan' => $plan];
}
