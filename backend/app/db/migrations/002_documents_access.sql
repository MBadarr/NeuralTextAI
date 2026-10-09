-- Documents are accessed through the server using DATABASE_URL's owner role.
-- Default-deny direct access by non-owner roles, including Data API clients.
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
