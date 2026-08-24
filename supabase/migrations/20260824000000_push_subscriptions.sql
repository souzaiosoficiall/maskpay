-- Web Push notifications: subscriptions table
-- Stores one row per browser/device Push Subscription, associated to the
-- authenticated user that created it. Sending is always performed by the
-- backend (service role); the client never has write access to other
-- users' rows and never sees another user's endpoint/keys.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    platform TEXT DEFAULT 'web',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalid')),
    last_error TEXT,
    last_success_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per endpoint: re-subscribing (e.g. after reopening the PWA)
-- upserts the same row instead of creating duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx
    ON public.push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
    ON public.push_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_status_idx
    ON public.push_subscriptions (user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- A user can only ever see/manage their own subscriptions. Sending push
-- messages is done exclusively from the server using the service role,
-- which bypasses RLS.
CREATE POLICY "Users can view their own push subscriptions"
    ON public.push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions"
    ON public.push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions"
    ON public.push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
    ON public.push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all push subscriptions"
    ON public.push_subscriptions FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Keep updated_at fresh on every write.
CREATE OR REPLACE FUNCTION public.set_push_subscription_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_push_subscription_updated_at();

-- Track whether a payment-confirmation push was already sent for a given
-- transaction. Combined with the existing "only transition pending ->
-- completed once" guard in the webhook handler, this makes push delivery
-- idempotent even if a provider redelivers the same event.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS push_notified_at TIMESTAMPTZ;
