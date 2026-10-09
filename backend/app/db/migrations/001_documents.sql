CREATE TABLE public.documents (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    position BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE
);

CREATE INDEX documents_owner_position_idx
    ON public.documents (owner_id, position DESC);
