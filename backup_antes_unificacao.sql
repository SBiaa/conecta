--
-- PostgreSQL database dump
--

\restrict 9cDr56p4RcQeYoMg0o65X8ERJaJkeIBleb37e3bWFNmfyFHMt4kW7Jw3LCmcAvv

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: FormaPagamento; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."FormaPagamento" AS ENUM (
    'DINHEIRO',
    'PIX',
    'CARTAO'
);


ALTER TYPE public."FormaPagamento" OWNER TO postgres;

--
-- Name: Papel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Papel" AS ENUM (
    'ADMIN',
    'ASSOCIADO'
);


ALTER TYPE public."Papel" OWNER TO postgres;

--
-- Name: Status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Status" AS ENUM (
    'ATIVO',
    'INATIVO'
);


ALTER TYPE public."Status" OWNER TO postgres;

--
-- Name: StatusPagamento; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StatusPagamento" AS ENUM (
    'PENDENTE',
    'PAGA'
);


ALTER TYPE public."StatusPagamento" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Aluna; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Aluna" (
    id integer NOT NULL,
    nome text NOT NULL,
    telefone text,
    ativa boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "turmaId" integer NOT NULL
);


ALTER TABLE public."Aluna" OWNER TO postgres;

--
-- Name: Aluna_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Aluna_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Aluna_id_seq" OWNER TO postgres;

--
-- Name: Aluna_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Aluna_id_seq" OWNED BY public."Aluna".id;


--
-- Name: Pagamento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Pagamento" (
    id integer NOT NULL,
    valor numeric(10,2) NOT NULL,
    "mesReferencia" text NOT NULL,
    vencimento timestamp(3) without time zone NOT NULL,
    status public."StatusPagamento" DEFAULT 'PENDENTE'::public."StatusPagamento" NOT NULL,
    "dataPagamento" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "alunaId" integer NOT NULL,
    "formaPagamento" public."FormaPagamento"
);


ALTER TABLE public."Pagamento" OWNER TO postgres;

--
-- Name: Pagamento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Pagamento_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Pagamento_id_seq" OWNER TO postgres;

--
-- Name: Pagamento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Pagamento_id_seq" OWNED BY public."Pagamento".id;


--
-- Name: Turma; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Turma" (
    id integer NOT NULL,
    nome text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Turma" OWNER TO postgres;

--
-- Name: Turma_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Turma_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Turma_id_seq" OWNER TO postgres;

--
-- Name: Turma_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Turma_id_seq" OWNED BY public."Turma".id;


--
-- Name: Usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Usuario" (
    id text NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    senha text NOT NULL,
    telefone text,
    papel public."Papel" DEFAULT 'ASSOCIADO'::public."Papel" NOT NULL,
    status public."Status" DEFAULT 'ATIVO'::public."Status" NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cpf text NOT NULL
);


ALTER TABLE public."Usuario" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: Aluna id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Aluna" ALTER COLUMN id SET DEFAULT nextval('public."Aluna_id_seq"'::regclass);


--
-- Name: Pagamento id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Pagamento" ALTER COLUMN id SET DEFAULT nextval('public."Pagamento_id_seq"'::regclass);


--
-- Name: Turma id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Turma" ALTER COLUMN id SET DEFAULT nextval('public."Turma_id_seq"'::regclass);


--
-- Data for Name: Aluna; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Aluna" (id, nome, telefone, ativa, "createdAt", "turmaId") FROM stdin;
1	Maria Silva	11999998888	t	2026-06-19 05:36:18.578	1
2	Maria 2	11934070411	t	2026-06-19 06:21:25.899	1
3	Bianca Siqueiraaa	11934070411	t	2026-06-19 13:40:38.617	1
\.


--
-- Data for Name: Pagamento; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Pagamento" (id, valor, "mesReferencia", vencimento, status, "dataPagamento", "createdAt", "alunaId", "formaPagamento") FROM stdin;
1	150.00	2026-06	2026-06-10 00:00:00	PAGA	2026-06-05 00:00:00	2026-06-19 05:37:02.376	1	\N
2	150.00	2026-07	2026-07-10 00:00:00	PENDENTE	\N	2026-06-19 05:54:35.532	1	\N
3	150.00	2026-05	2026-05-10 00:00:00	PAGA	2026-06-05 00:00:00	2026-06-19 06:01:31.914	1	\N
4	150.00	2026-04	2026-05-10 00:00:00	PAGA	2026-06-08 00:00:00	2026-06-19 13:08:51.079	1	PIX
5	150.00	2026-03	2026-05-10 00:00:00	PENDENTE	\N	2026-06-19 13:10:08.226	1	\N
6	150.00	2026-08	2026-07-10 00:00:00	PENDENTE	\N	2026-06-19 13:15:04.439	1	\N
8	150.00	2026-06	2026-07-10 00:00:00	PAGA	2026-06-19 00:00:00	2026-06-19 13:51:45.452	2	PIX
9	150.00	2026-06	2026-07-10 00:00:00	PAGA	2026-06-19 00:00:00	2026-06-19 13:51:45.452	3	PIX
7	150.00	2026-08	2026-07-10 00:00:00	PAGA	2026-06-19 00:00:00	2026-06-19 13:15:04.439	2	DINHEIRO
\.


--
-- Data for Name: Turma; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Turma" (id, nome, "createdAt") FROM stdin;
1	Seg/Qua - 8h	2026-06-19 05:35:44.901
\.


--
-- Data for Name: Usuario; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Usuario" (id, nome, email, senha, telefone, papel, status, "criadoEm", cpf) FROM stdin;
14e27d52-c117-4454-9497-5e2cba2b1f17	Administrador	admin@conecta.com	$2b$10$NGFwzQchP/d.XaItki0yuO4LmM1aHnnVFMLBOYmju4HispJ.SBGnK	\N	ADMIN	ATIVO	2026-05-17 03:04:05.782	00000000000
7c50ab76-def5-42f0-b98e-60ad5ec5b2d2	Maria Silva	maria@email.com	$2b$10$VmiIKmlKGu3qu5SxFHTjCuWKWSc3D5j4.fKpU9946YlHd84pdu73a	11999999999	ASSOCIADO	ATIVO	2026-05-17 03:11:40.585	12345678901
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
6c0375d5-7453-4505-9ccd-87c0a1d564c5	2ab32c0cb9bf0346007aa9879d2013f4b5d1c2dec0108770dc8aeb9990b10718	2026-05-16 23:41:10.19058-03	20260517024110_init	\N	\N	2026-05-16 23:41:10.14173-03	1
ac76da1f-f679-4780-a532-a0d68af28d2d	636d62b0fa0d081aafb691afdb5226c6d5b3cdbfa6a6188ce140fe66fada9093	2026-05-17 00:00:00.008018-03	20260517025959_add_cpf	\N	\N	2026-05-16 23:59:59.978519-03	1
09b5dc91-e991-4ebd-be42-16151f8bb780	fe1a8ea38dfaa1fe41758a8394d354e83639fd4bcd55d1a07a115e7b5d0fdbb8	2026-06-19 02:33:27.747395-03	20260619053327_mvp_financeiro	\N	\N	2026-06-19 02:33:27.610475-03	1
75488c2e-a907-45a9-84e4-b59ad040d397	ebc15028a3d4884f27d93774635040bc2ea8835325d3abbea6aa5b3d489ca377	2026-06-19 10:03:28.797873-03	20260619130328_add_forma_pagamento	\N	\N	2026-06-19 10:03:28.741879-03	1
\.


--
-- Name: Aluna_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Aluna_id_seq"', 3, true);


--
-- Name: Pagamento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Pagamento_id_seq"', 9, true);


--
-- Name: Turma_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Turma_id_seq"', 1, true);


--
-- Name: Aluna Aluna_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Aluna"
    ADD CONSTRAINT "Aluna_pkey" PRIMARY KEY (id);


--
-- Name: Pagamento Pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Pagamento"
    ADD CONSTRAINT "Pagamento_pkey" PRIMARY KEY (id);


--
-- Name: Turma Turma_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Turma"
    ADD CONSTRAINT "Turma_pkey" PRIMARY KEY (id);


--
-- Name: Usuario Usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "Usuario_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Usuario_cpf_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Usuario_cpf_key" ON public."Usuario" USING btree (cpf);


--
-- Name: Usuario_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Usuario_email_key" ON public."Usuario" USING btree (email);


--
-- Name: Aluna Aluna_turmaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Aluna"
    ADD CONSTRAINT "Aluna_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES public."Turma"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Pagamento Pagamento_alunaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Pagamento"
    ADD CONSTRAINT "Pagamento_alunaId_fkey" FOREIGN KEY ("alunaId") REFERENCES public."Aluna"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict 9cDr56p4RcQeYoMg0o65X8ERJaJkeIBleb37e3bWFNmfyFHMt4kW7Jw3LCmcAvv

