--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'Schema recriado via reset total';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: pagto_forma_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pagto_forma_enum AS ENUM (
    'dinheiro',
    'pix',
    'debito',
    'credito',
    'vale',
    'outro'
);


--
-- Name: pedido_canal_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pedido_canal_enum AS ENUM (
    'whatsapp',
    'pdv',
    'app',
    'outro'
);


--
-- Name: pedido_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pedido_status_enum AS ENUM (
    'aberto',
    'faturado',
    'cancelado'
);


--
-- Name: _after_itementradaprod_mut(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._after_itementradaprod_mut() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v_prod INT; v_q NUMERIC(14,3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_prod := NEW.chaveproduto; v_q := COALESCE(NEW.qtde,1);
    PERFORM _ensure_estoque_produto(v_prod);
    UPDATE produtoestoque
       SET qtentrada = COALESCE(qtentrada,0) + v_q,
           chaveitementrada = COALESCE(chaveitementrada, NEW.chave)
     WHERE chaveproduto = v_prod;
    PERFORM _recalc_estoque_produto(v_prod);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_prod := NEW.chaveproduto;
    PERFORM _ensure_estoque_produto(v_prod);
    UPDATE produtoestoque
       SET qtentrada = COALESCE(qtentrada,0) - COALESCE(OLD.qtde,1) + COALESCE(NEW.qtde,1),
           chaveitementrada = NEW.chave
     WHERE chaveproduto = v_prod;
    PERFORM _recalc_estoque_produto(v_prod);
    RETURN NEW;

  ELSE
    v_prod := OLD.chaveproduto;
    UPDATE produtoestoque
       SET qtentrada = COALESCE(qtentrada,0) - COALESCE(OLD.qtde,1)
     WHERE chaveproduto = v_prod;
    PERFORM _recalc_estoque_produto(v_prod);
    RETURN OLD;
  END IF;
END $$;


--
-- Name: _after_itementradaserv_mut(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._after_itementradaserv_mut() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_srv INT;
  v_q   NUMERIC(14,3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_srv := NEW.chaveservico;
    v_q   := COALESCE(NEW.qtde, 1);

    PERFORM _ensure_estoque_servico(v_srv);

    UPDATE servicoestoque
       SET qteentrada = COALESCE(qteentrada, 0) + v_q,
           chaveitementradaserv = COALESCE(chaveitementradaserv, NEW.chave)
     WHERE chaveservico = v_srv;

    PERFORM _recalc_estoque_servico(v_srv);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_srv := NEW.chaveservico;

    PERFORM _ensure_estoque_servico(v_srv);

    UPDATE servicoestoque
       SET qteentrada = COALESCE(qteentrada, 0)
                        - COALESCE(OLD.qtde, 1)
                        + COALESCE(NEW.qtde, 1),
           chaveitementradaserv = NEW.chave
     WHERE chaveservico = v_srv;

    PERFORM _recalc_estoque_servico(v_srv);
    RETURN NEW;

  ELSE -- DELETE
    v_srv := OLD.chaveservico;

    UPDATE servicoestoque
       SET qteentrada = COALESCE(qteentrada, 0) - COALESCE(OLD.qtde, 1)
     WHERE chaveservico = v_srv;

    PERFORM _recalc_estoque_servico(v_srv);
    RETURN OLD;
  END IF;
END
$$;


--
-- Name: _after_itemsaidaprod_mut(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._after_itemsaidaprod_mut() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v_prod INT; v_q NUMERIC(14,3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_prod := NEW.chaveproduto; v_q := COALESCE(NEW.qtde,1);
    PERFORM _ensure_estoque_produto(v_prod);
    UPDATE produtoestoque
       SET qtdesaida = COALESCE(qtdesaida,0) + v_q
     WHERE chaveproduto = v_prod;
    PERFORM _recalc_estoque_produto(v_prod);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_prod := NEW.chaveproduto;
    UPDATE produtoestoque
       SET qtdesaida = COALESCE(qtdesaida,0) - COALESCE(OLD.qtde,1) + COALESCE(NEW.qtde,1)
     WHERE chaveproduto = v_prod;
    PERFORM _recalc_estoque_produto(v_prod);
    RETURN NEW;

  ELSE
    v_prod := OLD.chaveproduto;
    UPDATE produtoestoque
       SET qtdesaida = COALESCE(qtdesaida,0) - COALESCE(OLD.qtde,1)
     WHERE chaveproduto = v_prod;
    PERFORM _recalc_estoque_produto(v_prod);
    RETURN OLD;
  END IF;
END $$;


--
-- Name: _after_itemsaidaserv_mut(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._after_itemsaidaserv_mut() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v_srv INT; v_q NUMERIC(14,3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_srv := NEW.chaveservico; v_q := COALESCE(NEW.qtde,1);
    PERFORM _ensure_estoque_servico(v_srv);
    UPDATE servicoestoque
       SET qtdesaida = COALESCE(qtdesaida,0) + v_q
     WHERE chaveservico = v_srv;
    PERFORM _recalc_estoque_servico(v_srv);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_srv := NEW.chaveservico;
    UPDATE servicoestoque
       SET qtdesaida = COALESCE(qtdesaida,0) - COALESCE(OLD.qtde,1) + COALESCE(NEW.qtde,1)
     WHERE chaveservico = v_srv;
    PERFORM _recalc_estoque_servico(v_srv);
    RETURN NEW;

  ELSE
    v_srv := OLD.chaveservico;
    UPDATE servicoestoque
       SET qtdesaida = COALESCE(qtdesaida,0) - COALESCE(OLD.qtde,1)
     WHERE chaveservico = v_srv;
    PERFORM _recalc_estoque_servico(v_srv);
    RETURN OLD;
  END IF;
END $$;


--
-- Name: _after_pedido_itens_estoque_mut(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._after_pedido_itens_estoque_mut() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_prod INT;
  v_q    NUMERIC(14,3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_prod := NEW.chaveproduto; v_q := COALESCE(NEW.qtde,1);
    PERFORM _ensure_estoque_produto(v_prod);
    UPDATE produtoestoque
       SET qtdesaida = COALESCE(qtdesaida,0) + v_q
     WHERE chaveproduto = v_prod;
    PERFORM _recalc_estoque_produto(v_prod);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_prod := NEW.chaveproduto;
    PERFORM _ensure_estoque_produto(v_prod);
    UPDATE produtoestoque
       SET qtdesaida = COALESCE(qtdesaida,0) - COALESCE(OLD.qtde,1) + COALESCE(NEW.qtde,1)
     WHERE chaveproduto = v_prod;
    PERFORM _recalc_estoque_produto(v_prod);
    RETURN NEW;

  ELSE
    v_prod := OLD.chaveproduto;
    UPDATE produtoestoque
       SET qtdesaida = COALESCE(qtdesaida,0) - COALESCE(OLD.qtde,1)
     WHERE chaveproduto = v_prod;
    PERFORM _recalc_estoque_produto(v_prod);
    RETURN OLD;
  END IF;
END
$$;


--
-- Name: FUNCTION _after_pedido_itens_estoque_mut(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public._after_pedido_itens_estoque_mut() IS 'MantÔö£┬«m baixa de estoque em produtoestoque conforme itens do pedido.';


--
-- Name: _after_pedido_itens_recalc(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._after_pedido_itens_recalc() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE pedidos p
     SET subtotal    = COALESCE((
                        SELECT SUM(COALESCE(i.valortotal,0))
                        FROM pedido_itens i
                        WHERE i.chavepedido = p.chave
                      ),0),
         total       = COALESCE((
                        SELECT SUM(COALESCE(i.valortotal,0))
                        FROM pedido_itens i
                        WHERE i.chavepedido = p.chave
                      ),0) - COALESCE(p.desconto,0) + COALESCE(p.acrescimo,0),
         datahoraalt = NOW()
   WHERE p.chave = COALESCE(NEW.chavepedido, OLD.chavepedido);
  RETURN COALESCE(NEW, OLD);
END
$$;


--
-- Name: FUNCTION _after_pedido_itens_recalc(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public._after_pedido_itens_recalc() IS 'Atualiza subtotal/total do pedido apÔö£Ôöés inserts/updates/deletes em pedido_itens.';


--
-- Name: _calc_valortotal_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._calc_valortotal_items() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.valortotal := ROUND(COALESCE(NEW.qtde,1) * COALESCE(NEW.valorunit,0), 2);
  RETURN NEW;
END $$;


--
-- Name: _ensure_estoque_produto(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._ensure_estoque_produto(_chaveproduto integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO produtoestoque (ativo, chaveproduto, qtentrada, qtdesaida, qtdtotal)
  SELECT 1, _chaveproduto, 0, 0, 0
  WHERE NOT EXISTS (SELECT 1 FROM produtoestoque WHERE chaveproduto = _chaveproduto);
END $$;


--
-- Name: _ensure_estoque_servico(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._ensure_estoque_servico(_chaveservico integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO servicoestoque (ativo, chaveservico, qteentrada, qtdesaida, qtdetotal)
  SELECT 1, _chaveservico, 0, 0, 0
  WHERE NOT EXISTS (
    SELECT 1 FROM servicoestoque WHERE chaveservico = _chaveservico
  );
END
$$;


--
-- Name: _log_pedido_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._log_pedido_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  de_label  text;
  para_label text;
BEGIN
  -- Se a tabela de log não existir, apenas segue (evita falhas em ambientes sem log)
  PERFORM 1
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'pedido_log';
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Descobre o rótulo do enum correspondente ao ordinal OLD.status (1 → 1º rótulo, etc.)
  SELECT e.enumlabel
    INTO de_label
    FROM pg_enum e
   WHERE e.enumtypid = 'pedido_status_enum'::regtype
   ORDER BY e.enumsortorder
   OFFSET GREATEST(COALESCE(OLD.status,1),1) - 1
   LIMIT 1;

  SELECT e.enumlabel
    INTO para_label
    FROM pg_enum e
   WHERE e.enumtypid = 'pedido_status_enum'::regtype
   ORDER BY e.enumsortorder
   OFFSET GREATEST(COALESCE(NEW.status,1),1) - 1
   LIMIT 1;

  -- Se por alguma razão não achou rótulos, não quebra a atualização
  IF de_label IS NULL OR para_label IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO pedido_log (chavepedido, de_status, para_status, usuario, motivo)
  VALUES (OLD.chave,
          de_label::pedido_status_enum,
          para_label::pedido_status_enum,
          current_user,
          NULL);

  RETURN NEW;
END
$$;


--
-- Name: FUNCTION _log_pedido_status(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public._log_pedido_status() IS 'Auditoria de transiÔö£┬║Ôö£├║o de status em pedidos.';


--
-- Name: _recalc_estoque_produto(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._recalc_estoque_produto(_chaveproduto integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE produtoestoque e
     SET qtdtotal = COALESCE(e.qtentrada,0) - COALESCE(e.qtdesaida,0),
         datahoraalt = NOW()
   WHERE e.chaveproduto = _chaveproduto;
END $$;


--
-- Name: _recalc_estoque_servico(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._recalc_estoque_servico(_chaveservico integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE servicoestoque e
     SET qtdetotal  = COALESCE(e.qteentrada, 0) - COALESCE(e.qtdesaida, 0),
         datahoraalt = NOW()
   WHERE e.chaveservico = _chaveservico;
END
$$;


--
-- Name: apigs_sync_from_json(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apigs_sync_from_json() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  j JSONB;
BEGIN
  IF NEW.service_json IS NOT NULL AND length(btrim(NEW.service_json)) > 0 THEN
    BEGIN
      j := NEW.service_json::JSONB;

      -- Preenche campos a partir do JSON, sem sobrescrever valores jÔö£├¡ informados explicitamente
      NEW.project_id                       := COALESCE(NEW.project_id,                       j->>'project_id');
      NEW.private_key_id                   := COALESCE(NEW.private_key_id,                   j->>'private_key_id');
      NEW.client_email                     := COALESCE(NEW.client_email,                     j->>'client_email');
      -- Normaliza quebras de linha na chave privada
      NEW.private_key                      := COALESCE(NEW.private_key,                      REPLACE(COALESCE(j->>'private_key',''), '\n', E'\n'));
      NEW.client_id                        := COALESCE(NEW.client_id,                        j->>'client_id');
      NEW.auth_uri                         := COALESCE(NEW.auth_uri,                         j->>'auth_uri');
      NEW.token_uri                        := COALESCE(NEW.token_uri,                        j->>'token_uri');
      NEW.auth_provider_x509_cert_url      := COALESCE(NEW.auth_provider_x509_cert_url,      j->>'auth_provider_x509_cert_url');
      NEW.client_x509_cert_url             := COALESCE(NEW.client_x509_cert_url,             j->>'client_x509_cert_url');
      NEW.universe_domain                  := COALESCE(NEW.universe_domain,                  j->>'universe_domain');
    EXCEPTION WHEN OTHERS THEN
      -- Se o JSON estiver invÔö£├¡lido, mantÔö£┬«m como estÔö£├¡; a aplicaÔö£┬║Ôö£├║o pode validar no salvamento
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: apigs_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apigs_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  NEW.datahoraalt := now();
  IF NEW.datahoracad IS NULL THEN
    NEW.datahoracad := now();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: fn_servicoestoque_adjust(integer, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_servicoestoque_adjust(p_chaveservico integer, p_delta_entrada numeric, p_delta_saida numeric) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- se nÔö£├║o existe, cria a linha base
  INSERT INTO servicoestoque (chaveservico, qteentrada, qtdesaida, qtdetotal)
  VALUES (p_chaveservico, 0, 0, 0)
  ON CONFLICT (chaveservico) DO NOTHING;

  -- aplica os deltas (>= 0 recomendÔö£├¡vel)
  UPDATE servicoestoque
     SET qteentrada = qteentrada + COALESCE(p_delta_entrada, 0),
         qtdesaida  = qtdesaida  + COALESCE(p_delta_saida, 0),
         qtdetotal  = (qteentrada + COALESCE(p_delta_entrada, 0))
                      - (qtdesaida  + COALESCE(p_delta_saida, 0)),
         datahoraalt = NOW()
   WHERE chaveservico = p_chaveservico;
END;
$$;


--
-- Name: trg_produtos_valorvenda_default(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_produtos_valorvenda_default() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.valorvenda IS NULL THEN
    NEW.valorvenda := NEW.valorcompra;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: trg_servicoestoque_recalc_total(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_servicoestoque_recalc_total() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.qtdetotal := COALESCE(NEW.qteentrada,0) - COALESCE(NEW.qtdesaida,0);
  NEW.datahoraalt := NOW();
  RETURN NEW;
END;
$$;


--
-- Name: trg_sessions_seen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_sessions_seen() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN NEW.last_seen = now(); RETURN NEW; END $$;


--
-- Name: trg_set_datahoraalt(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_datahoraalt() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.datahoraalt := NOW();
  RETURN NEW;
END;
$$;


--
-- Name: trg_touch_alteracao(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_touch_alteracao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.datahoraalt := now();
  RETURN NEW;
END $$;


--
-- Name: trg_usuarios_alt(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_usuarios_alt() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN NEW.datahoraalt = now(); RETURN NEW; END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: apigooglesheets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apigooglesheets (
    chave text DEFAULT (gen_random_uuid())::text NOT NULL,
    valor text,
    updated_at timestamp without time zone DEFAULT now(),
    ativo smallint DEFAULT 1 NOT NULL,
    chaveemp integer,
    apelido text,
    google_sheet_id text NOT NULL,
    google_sheet_range text DEFAULT 'PÔö£├¡gina2!A2:J'::text NOT NULL,
    service_json text,
    client_email text,
    private_key text,
    datahoracad timestamp with time zone DEFAULT now() NOT NULL,
    datahoraalt timestamp with time zone,
    project_id text,
    private_key_id text,
    client_id text,
    auth_uri text,
    token_uri text,
    auth_provider_x509_cert_url text,
    client_x509_cert_url text,
    universe_domain text
);


--
-- Name: apigs_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apigs_config (
    chave integer NOT NULL,
    google_sheet_id text NOT NULL,
    google_sheet_range character varying(255),
    project_id character varying(255) NOT NULL,
    private_key text NOT NULL,
    client_email character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: apigs_config_chave_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.apigs_config_chave_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: apigs_config_chave_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.apigs_config_chave_seq OWNED BY public.apigs_config.chave;


--
-- Name: cardapio_semana; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cardapio_semana (
    chave integer NOT NULL,
    dia_semana smallint NOT NULL,
    almoco text,
    janta text,
    preco_almoco numeric(14,2),
    preco_janta numeric(14,2),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT cardapio_semana_dia_semana_check CHECK (((dia_semana >= 1) AND (dia_semana <= 7)))
);


--
-- Name: cardapio_semana_chave_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cardapio_semana_chave_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cardapio_semana_chave_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cardapio_semana_chave_seq OWNED BY public.cardapio_semana.chave;


--
-- Name: seq_clifor_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_clifor_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_clifor_codigo; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_clifor_codigo
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clifor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clifor (
    chave integer DEFAULT nextval('public.seq_clifor_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    codigo integer DEFAULT nextval('public.seq_clifor_codigo'::regclass) NOT NULL,
    nome text NOT NULL,
    fisjur character(1) NOT NULL,
    tipo smallint NOT NULL,
    pertenceemp integer,
    email text,
    cpf text,
    telefone text,
    endereco text,
    datahoracad timestamp without time zone DEFAULT now() NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT clifor_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2]))),
    CONSTRAINT clifor_fisjur_check CHECK ((fisjur = ANY (ARRAY['F'::bpchar, 'J'::bpchar]))),
    CONSTRAINT clifor_tipo_check CHECK ((tipo = ANY (ARRAY[1, 2, 3])))
);


--
-- Name: seq_cliforemp_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_cliforemp_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cliforemp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliforemp (
    chave integer DEFAULT nextval('public.seq_cliforemp_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    chaveclifor integer NOT NULL,
    chaveemp integer NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT cliforemp_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2])))
);


--
-- Name: seq_empresa_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_empresa_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_empresa_codigo; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_empresa_codigo
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa (
    chave integer DEFAULT nextval('public.seq_empresa_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    nome text NOT NULL,
    codigo integer DEFAULT nextval('public.seq_empresa_codigo'::regclass) NOT NULL,
    cnpj text NOT NULL,
    datahoracad timestamp without time zone DEFAULT now() NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT empresa_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2])))
);


--
-- Name: seq_entradas_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_entradas_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_entradas_codigo; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_entradas_codigo
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entradas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entradas (
    chave integer DEFAULT nextval('public.seq_entradas_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    codigo integer DEFAULT nextval('public.seq_entradas_codigo'::regclass) NOT NULL,
    chaveclifor integer NOT NULL,
    datahoracad timestamp without time zone DEFAULT now() NOT NULL,
    obs text,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT entradas_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2])))
);


--
-- Name: seq_itementradaprod_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_itementradaprod_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: itementradaprod; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itementradaprod (
    chave integer DEFAULT nextval('public.seq_itementradaprod_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    chaveentrada integer NOT NULL,
    chaveproduto integer NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    qtde numeric(14,3) DEFAULT 1 NOT NULL,
    valorunit numeric(14,2) DEFAULT 0 NOT NULL,
    valortotal numeric(14,2),
    CONSTRAINT itementradaprod_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2])))
);


--
-- Name: seq_itementradaserv_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_itementradaserv_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: itementradaserv; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itementradaserv (
    chave integer DEFAULT nextval('public.seq_itementradaserv_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    chaveentrada integer NOT NULL,
    chaveservico integer NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    qtde numeric(14,3) DEFAULT 1 NOT NULL,
    valorunit numeric(14,2) DEFAULT 0 NOT NULL,
    valortotal numeric(14,2),
    CONSTRAINT itementradaserv_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2])))
);


--
-- Name: seq_itemsaidaprod_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_itemsaidaprod_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: itemsaidaprod; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itemsaidaprod (
    chave integer DEFAULT nextval('public.seq_itemsaidaprod_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    chavesaida integer NOT NULL,
    chaveproduto integer NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    qtde numeric(14,3) DEFAULT 1 NOT NULL,
    valorunit numeric(14,2) DEFAULT 0 NOT NULL,
    valortotal numeric(14,2),
    CONSTRAINT itemsaidaprod_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2])))
);


--
-- Name: seq_itemsaidaserv_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_itemsaidaserv_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: itemsaidaserv; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itemsaidaserv (
    chave integer DEFAULT nextval('public.seq_itemsaidaserv_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    chavesaida integer NOT NULL,
    chaveservico integer NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    qtde numeric(14,3) DEFAULT 1 NOT NULL,
    valorunit numeric(14,2) DEFAULT 0 NOT NULL,
    valortotal numeric(14,2),
    CONSTRAINT itemsaidaserv_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2])))
);


--
-- Name: pedido_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedido_itens (
    chave integer NOT NULL,
    chavepedido integer NOT NULL,
    chaveproduto integer NOT NULL,
    qtde numeric(14,3) DEFAULT 1 NOT NULL,
    valorunit numeric(14,2) DEFAULT 0 NOT NULL,
    desconto numeric(14,2) DEFAULT 0 NOT NULL,
    valortotal numeric(14,2)
);


--
-- Name: pedido_itens_chave_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedido_itens_chave_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedido_itens_chave_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedido_itens_chave_seq OWNED BY public.pedido_itens.chave;


--
-- Name: pedido_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedido_log (
    chave integer NOT NULL,
    chavepedido integer NOT NULL,
    de_status public.pedido_status_enum,
    para_status public.pedido_status_enum,
    datahora timestamp without time zone DEFAULT now() NOT NULL,
    usuario text,
    motivo text
);


--
-- Name: pedido_log_chave_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedido_log_chave_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedido_log_chave_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedido_log_chave_seq OWNED BY public.pedido_log.chave;


--
-- Name: pedido_pagamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedido_pagamentos (
    chave integer NOT NULL,
    chavepedido integer NOT NULL,
    forma public.pagto_forma_enum NOT NULL,
    valor numeric(14,2) NOT NULL,
    datahora timestamp without time zone DEFAULT now() NOT NULL,
    detalhes text
);


--
-- Name: pedido_pagamentos_chave_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedido_pagamentos_chave_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedido_pagamentos_chave_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedido_pagamentos_chave_seq OWNED BY public.pedido_pagamentos.chave;


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos (
    chave integer NOT NULL,
    chaveemp integer,
    chaveclifor integer,
    numero text,
    canal public.pedido_canal_enum,
    datahoracad timestamp without time zone DEFAULT now() NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    obs text,
    subtotal numeric(14,2) DEFAULT 0,
    desconto numeric(14,2) DEFAULT 0,
    acrescimo numeric(14,2) DEFAULT 0,
    total numeric(14,2) DEFAULT 0,
    ativo smallint DEFAULT 1 NOT NULL,
    status smallint DEFAULT 1,
    bot boolean DEFAULT false NOT NULL,
    source_hash character varying(40),
    CONSTRAINT pedidos_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2]))),
    CONSTRAINT pedidos_status_chk CHECK ((status = ANY (ARRAY[1, 2, 3])))
);


--
-- Name: pedidos_chave_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedidos_chave_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedidos_chave_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedidos_chave_seq OWNED BY public.pedidos.chave;


--
-- Name: seq_produtoestoque_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_produtoestoque_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: produtoestoque; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produtoestoque (
    chave integer DEFAULT nextval('public.seq_produtoestoque_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    chaveproduto integer NOT NULL,
    qteentrada numeric(14,3) DEFAULT 0 NOT NULL,
    qtdesaida numeric(14,3) DEFAULT 0 NOT NULL,
    qtdetotal numeric(14,3) GENERATED ALWAYS AS ((COALESCE(qteentrada, (0)::numeric) + COALESCE(qtdesaida, (0)::numeric))) STORED,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    chaveitementrada integer,
    qtentrada numeric(14,3) DEFAULT 0 NOT NULL,
    qtdtotal numeric(14,3) DEFAULT 0 NOT NULL,
    CONSTRAINT produtoestoque_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2]))),
    CONSTRAINT produtoestoque_qteentrada_check CHECK ((qteentrada >= (0)::numeric))
);


--
-- Name: seq_produtos_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_produtos_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_produtos_codigo; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_produtos_codigo
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: produtos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produtos (
    chave integer DEFAULT nextval('public.seq_produtos_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    codigo integer DEFAULT nextval('public.seq_produtos_codigo'::regclass) NOT NULL,
    nome text NOT NULL,
    chaveemp integer,
    valorcompra numeric(14,2) NOT NULL,
    valorvenda numeric(14,2),
    obs text,
    categoria integer DEFAULT 1 NOT NULL,
    validade date,
    datahoracad timestamp without time zone DEFAULT now() NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_prod_preco_nonneg CHECK (((valorcompra >= (0)::numeric) AND ((valorvenda IS NULL) OR (valorvenda >= (0)::numeric)))),
    CONSTRAINT produtos_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2])))
);


--
-- Name: seq_saidas_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_saidas_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_saidas_codigo; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_saidas_codigo
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: saidas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saidas (
    chave integer DEFAULT nextval('public.seq_saidas_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    codigo integer DEFAULT nextval('public.seq_saidas_codigo'::regclass) NOT NULL,
    chaveclifor integer NOT NULL,
    datahoracad timestamp without time zone DEFAULT now() NOT NULL,
    obs text,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now(),
    CONSTRAINT saidas_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2])))
);


--
-- Name: seq_servicos_chave; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_servicos_chave
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_servicos_codigo; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_servicos_codigo
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicoestoque; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicoestoque (
    chave integer NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    chaveservico integer NOT NULL,
    qteentrada numeric(14,3) DEFAULT 0 NOT NULL,
    qtdesaida numeric(14,3) DEFAULT 0 NOT NULL,
    qtdetotal numeric(14,3) DEFAULT 0 NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    chaveitementradaserv integer,
    CONSTRAINT servicoestoque_ativo_chk CHECK ((ativo = ANY (ARRAY[0, 1]))),
    CONSTRAINT servicoestoque_qtd_chk CHECK (((qteentrada >= (0)::numeric) AND (qtdesaida >= (0)::numeric)))
);


--
-- Name: servicoestoque_chave_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servicoestoque_chave_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicoestoque_chave_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.servicoestoque_chave_seq OWNED BY public.servicoestoque.chave;


--
-- Name: servicos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicos (
    chave integer DEFAULT nextval('public.seq_servicos_chave'::regclass) NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    codigo integer DEFAULT nextval('public.seq_servicos_codigo'::regclass) NOT NULL,
    nome text NOT NULL,
    chaveemp integer,
    valorvenda numeric(14,2) NOT NULL,
    obs text,
    categoria integer DEFAULT 1 NOT NULL,
    validade date,
    datahoracad timestamp without time zone DEFAULT now() NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    prazoentrega date,
    CONSTRAINT ck_serv_preco_nonneg CHECK ((valorvenda >= (0)::numeric)),
    CONSTRAINT servicos_ativo_check CHECK ((ativo = ANY (ARRAY[1, 2])))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    token text NOT NULL,
    chaveusuario bigint NOT NULL,
    user_agent text,
    ip text,
    created_at timestamp without time zone DEFAULT now(),
    last_seen timestamp without time zone DEFAULT now()
);


--
-- Name: sheet_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sheet_imports (
    chave bigint NOT NULL,
    sheet_id text NOT NULL,
    row_hash text NOT NULL,
    raw jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: sheet_imports_chave_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sheet_imports_chave_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sheet_imports_chave_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sheet_imports_chave_seq OWNED BY public.sheet_imports.chave;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    chave bigint NOT NULL,
    ativo smallint DEFAULT 1 NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    senha text NOT NULL,
    perfil text DEFAULT 'operador'::text,
    session_token text,
    session_expira_em timestamp without time zone,
    session_user_agent text,
    session_ip text,
    datahoracad timestamp without time zone DEFAULT now() NOT NULL,
    datahoraalt timestamp without time zone DEFAULT now() NOT NULL,
    cpf_cnpj text,
    CONSTRAINT usuarios_ativo_check CHECK ((ativo = ANY (ARRAY[0, 1, 3])))
);


--
-- Name: usuarios_chave_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_chave_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_chave_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_chave_seq OWNED BY public.usuarios.chave;


--
-- Name: apigs_config chave; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apigs_config ALTER COLUMN chave SET DEFAULT nextval('public.apigs_config_chave_seq'::regclass);


--
-- Name: cardapio_semana chave; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cardapio_semana ALTER COLUMN chave SET DEFAULT nextval('public.cardapio_semana_chave_seq'::regclass);


--
-- Name: pedido_itens chave; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_itens ALTER COLUMN chave SET DEFAULT nextval('public.pedido_itens_chave_seq'::regclass);


--
-- Name: pedido_log chave; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_log ALTER COLUMN chave SET DEFAULT nextval('public.pedido_log_chave_seq'::regclass);


--
-- Name: pedido_pagamentos chave; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_pagamentos ALTER COLUMN chave SET DEFAULT nextval('public.pedido_pagamentos_chave_seq'::regclass);


--
-- Name: pedidos chave; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos ALTER COLUMN chave SET DEFAULT nextval('public.pedidos_chave_seq'::regclass);


--
-- Name: servicoestoque chave; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicoestoque ALTER COLUMN chave SET DEFAULT nextval('public.servicoestoque_chave_seq'::regclass);


--
-- Name: sheet_imports chave; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sheet_imports ALTER COLUMN chave SET DEFAULT nextval('public.sheet_imports_chave_seq'::regclass);


--
-- Name: usuarios chave; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN chave SET DEFAULT nextval('public.usuarios_chave_seq'::regclass);


--
-- Name: apigooglesheets apigooglesheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apigooglesheets
    ADD CONSTRAINT apigooglesheets_pkey PRIMARY KEY (chave);


--
-- Name: apigs_config apigs_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apigs_config
    ADD CONSTRAINT apigs_config_pkey PRIMARY KEY (chave);


--
-- Name: cardapio_semana cardapio_semana_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cardapio_semana
    ADD CONSTRAINT cardapio_semana_pkey PRIMARY KEY (chave);


--
-- Name: clifor clifor_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clifor
    ADD CONSTRAINT clifor_codigo_key UNIQUE (codigo);


--
-- Name: clifor clifor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clifor
    ADD CONSTRAINT clifor_pkey PRIMARY KEY (chave);


--
-- Name: cliforemp cliforemp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliforemp
    ADD CONSTRAINT cliforemp_pkey PRIMARY KEY (chave);


--
-- Name: empresa empresa_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_codigo_key UNIQUE (codigo);


--
-- Name: empresa empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_pkey PRIMARY KEY (chave);


--
-- Name: entradas entradas_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_codigo_key UNIQUE (codigo);


--
-- Name: entradas entradas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_pkey PRIMARY KEY (chave);


--
-- Name: itementradaprod itementradaprod_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itementradaprod
    ADD CONSTRAINT itementradaprod_pkey PRIMARY KEY (chave);


--
-- Name: itementradaserv itementradaserv_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itementradaserv
    ADD CONSTRAINT itementradaserv_pkey PRIMARY KEY (chave);


--
-- Name: itemsaidaprod itemsaidaprod_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itemsaidaprod
    ADD CONSTRAINT itemsaidaprod_pkey PRIMARY KEY (chave);


--
-- Name: itemsaidaserv itemsaidaserv_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itemsaidaserv
    ADD CONSTRAINT itemsaidaserv_pkey PRIMARY KEY (chave);


--
-- Name: pedido_itens pedido_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_itens
    ADD CONSTRAINT pedido_itens_pkey PRIMARY KEY (chave);


--
-- Name: pedido_log pedido_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_log
    ADD CONSTRAINT pedido_log_pkey PRIMARY KEY (chave);


--
-- Name: pedido_pagamentos pedido_pagamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_pagamentos
    ADD CONSTRAINT pedido_pagamentos_pkey PRIMARY KEY (chave);


--
-- Name: pedidos pedidos_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_numero_key UNIQUE (numero);


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (chave);


--
-- Name: produtoestoque produtoestoque_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtoestoque
    ADD CONSTRAINT produtoestoque_pkey PRIMARY KEY (chave);


--
-- Name: produtos produtos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_codigo_key UNIQUE (codigo);


--
-- Name: produtos produtos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_pkey PRIMARY KEY (chave);


--
-- Name: saidas saidas_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saidas
    ADD CONSTRAINT saidas_codigo_key UNIQUE (codigo);


--
-- Name: saidas saidas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saidas
    ADD CONSTRAINT saidas_pkey PRIMARY KEY (chave);


--
-- Name: servicoestoque servicoestoque_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicoestoque
    ADD CONSTRAINT servicoestoque_pkey PRIMARY KEY (chave);


--
-- Name: servicos servicos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos
    ADD CONSTRAINT servicos_codigo_key UNIQUE (codigo);


--
-- Name: servicos servicos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos
    ADD CONSTRAINT servicos_pkey PRIMARY KEY (chave);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (token);


--
-- Name: sheet_imports sheet_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sheet_imports
    ADD CONSTRAINT sheet_imports_pkey PRIMARY KEY (chave);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (chave);


--
-- Name: usuarios usuarios_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_session_token_key UNIQUE (session_token);


--
-- Name: idx_apigooglesheets_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apigooglesheets_ativo ON public.apigooglesheets USING btree (ativo);


--
-- Name: idx_apigooglesheets_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apigooglesheets_emp ON public.apigooglesheets USING btree (COALESCE(chaveemp, 0));


--
-- Name: idx_apigs_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apigs_ativo ON public.apigooglesheets USING btree (ativo);


--
-- Name: idx_apigs_chaveemp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apigs_chaveemp ON public.apigooglesheets USING btree (chaveemp);


--
-- Name: idx_clifor_telefone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clifor_telefone ON public.clifor USING btree (telefone);


--
-- Name: idx_pedidos_datahoracad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_datahoracad ON public.pedidos USING btree (datahoracad);


--
-- Name: idx_pedidos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_status ON public.pedidos USING btree (status);


--
-- Name: idx_produtoestoque_chaveitementrada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtoestoque_chaveitementrada ON public.produtoestoque USING btree (chaveitementrada);


--
-- Name: idx_produtoestoque_chaveproduto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtoestoque_chaveproduto ON public.produtoestoque USING btree (chaveproduto);


--
-- Name: idx_servicoestoque_chaveitementradaserv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicoestoque_chaveitementradaserv ON public.servicoestoque USING btree (chaveitementradaserv);


--
-- Name: idx_servicoestoque_chaveservico; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicoestoque_chaveservico ON public.servicoestoque USING btree (chaveservico);


--
-- Name: idx_usuarios_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_email_lower ON public.usuarios USING btree (lower(email));


--
-- Name: idx_usuarios_session_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_session_token ON public.usuarios USING btree (session_token);


--
-- Name: ix_pedido_itens_ped; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pedido_itens_ped ON public.pedido_itens USING btree (chavepedido);


--
-- Name: ix_pedido_itens_prod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pedido_itens_prod ON public.pedido_itens USING btree (chaveproduto);


--
-- Name: ix_pedidos_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pedidos_cliente ON public.pedidos USING btree (chaveclifor);


--
-- Name: ix_pedidos_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pedidos_data ON public.pedidos USING btree (datahoracad);


--
-- Name: ix_pedidos_numero_nnl; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pedidos_numero_nnl ON public.pedidos USING btree (numero) WHERE (numero IS NOT NULL);


--
-- Name: ix_usuarios_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_usuarios_email ON public.usuarios USING btree (email);


--
-- Name: ix_usuarios_session_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_usuarios_session_token ON public.usuarios USING btree (session_token);


--
-- Name: ux_cardapio_semana_dia; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_cardapio_semana_dia ON public.cardapio_semana USING btree (dia_semana);


--
-- Name: ux_clifor_cpf; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_clifor_cpf ON public.clifor USING btree (cpf) WHERE ((cpf IS NOT NULL) AND (cpf <> ''::text));


--
-- Name: ux_pedidos_whatsapp_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_pedidos_whatsapp_hash ON public.pedidos USING btree (source_hash) WHERE (canal = 'whatsapp'::public.pedido_canal_enum);


--
-- Name: ux_sheet_imports; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_sheet_imports ON public.sheet_imports USING btree (sheet_id, row_hash);


--
-- Name: itementradaprod aiud_itementradaprod_estoque; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aiud_itementradaprod_estoque AFTER INSERT OR DELETE OR UPDATE ON public.itementradaprod FOR EACH ROW EXECUTE FUNCTION public._after_itementradaprod_mut();


--
-- Name: itementradaserv aiud_itementradaserv_estoque; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aiud_itementradaserv_estoque AFTER INSERT OR DELETE OR UPDATE ON public.itementradaserv FOR EACH ROW EXECUTE FUNCTION public._after_itementradaserv_mut();


--
-- Name: itemsaidaprod aiud_itemsaidaprod_estoque; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aiud_itemsaidaprod_estoque AFTER INSERT OR DELETE OR UPDATE ON public.itemsaidaprod FOR EACH ROW EXECUTE FUNCTION public._after_itemsaidaprod_mut();


--
-- Name: itemsaidaserv aiud_itemsaidaserv_estoque; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aiud_itemsaidaserv_estoque AFTER INSERT OR DELETE OR UPDATE ON public.itemsaidaserv FOR EACH ROW EXECUTE FUNCTION public._after_itemsaidaserv_mut();


--
-- Name: pedido_itens aiud_pedido_itens_estoque; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aiud_pedido_itens_estoque AFTER INSERT OR DELETE OR UPDATE ON public.pedido_itens FOR EACH ROW EXECUTE FUNCTION public._after_pedido_itens_estoque_mut();


--
-- Name: pedido_itens aiud_pedido_itens_recalc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aiud_pedido_itens_recalc AFTER INSERT OR DELETE OR UPDATE ON public.pedido_itens FOR EACH ROW EXECUTE FUNCTION public._after_pedido_itens_recalc();


--
-- Name: itementradaprod biu_itementradaprod_valor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER biu_itementradaprod_valor BEFORE INSERT OR UPDATE OF qtde, valorunit ON public.itementradaprod FOR EACH ROW EXECUTE FUNCTION public._calc_valortotal_items();


--
-- Name: itementradaserv biu_itementradaserv_valor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER biu_itementradaserv_valor BEFORE INSERT OR UPDATE OF qtde, valorunit ON public.itementradaserv FOR EACH ROW EXECUTE FUNCTION public._calc_valortotal_items();


--
-- Name: itemsaidaprod biu_itemsaidaprod_valor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER biu_itemsaidaprod_valor BEFORE INSERT OR UPDATE OF qtde, valorunit ON public.itemsaidaprod FOR EACH ROW EXECUTE FUNCTION public._calc_valortotal_items();


--
-- Name: itemsaidaserv biu_itemsaidaserv_valor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER biu_itemsaidaserv_valor BEFORE INSERT OR UPDATE OF qtde, valorunit ON public.itemsaidaserv FOR EACH ROW EXECUTE FUNCTION public._calc_valortotal_items();


--
-- Name: pedido_itens biu_pedido_itens_valor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER biu_pedido_itens_valor BEFORE INSERT OR UPDATE OF qtde, valorunit, desconto ON public.pedido_itens FOR EACH ROW EXECUTE FUNCTION public._calc_valortotal_items();


--
-- Name: pedidos biu_pedidos_status_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER biu_pedidos_status_log BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public._log_pedido_status();


--
-- Name: servicoestoque tbiu_servicoestoque_recalc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tbiu_servicoestoque_recalc BEFORE INSERT OR UPDATE ON public.servicoestoque FOR EACH ROW EXECUTE FUNCTION public.trg_servicoestoque_recalc_total();


--
-- Name: clifor tg_clifor_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_clifor_upd BEFORE UPDATE ON public.clifor FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: cliforemp tg_cliforemp_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_cliforemp_upd BEFORE UPDATE ON public.cliforemp FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: empresa tg_empresa_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_empresa_upd BEFORE UPDATE ON public.empresa FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: entradas tg_entradas_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_entradas_upd BEFORE UPDATE ON public.entradas FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: itementradaprod tg_ieprod_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_ieprod_upd BEFORE UPDATE ON public.itementradaprod FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: itementradaserv tg_ieserv_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_ieserv_upd BEFORE UPDATE ON public.itementradaserv FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: itemsaidaprod tg_isprod_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_isprod_upd BEFORE UPDATE ON public.itemsaidaprod FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: itemsaidaserv tg_isserv_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_isserv_upd BEFORE UPDATE ON public.itemsaidaserv FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: produtoestoque tg_pestoque_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_pestoque_upd BEFORE UPDATE ON public.produtoestoque FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: produtos tg_produtos_before_insupd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_produtos_before_insupd BEFORE INSERT OR UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.trg_produtos_valorvenda_default();


--
-- Name: produtos tg_produtos_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_produtos_upd BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: saidas tg_saidas_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_saidas_upd BEFORE UPDATE ON public.saidas FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: servicos tg_servicos_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_servicos_upd BEFORE UPDATE ON public.servicos FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: usuarios tg_usuarios_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_usuarios_touch BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.trg_touch_alteracao();


--
-- Name: apigooglesheets trg_apigs_sync_from_json_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_apigs_sync_from_json_ins BEFORE INSERT ON public.apigooglesheets FOR EACH ROW EXECUTE FUNCTION public.apigs_sync_from_json();


--
-- Name: apigooglesheets trg_apigs_sync_from_json_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_apigs_sync_from_json_upd BEFORE UPDATE ON public.apigooglesheets FOR EACH ROW EXECUTE FUNCTION public.apigs_sync_from_json();


--
-- Name: apigooglesheets trg_apigs_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_apigs_touch BEFORE INSERT OR UPDATE ON public.apigooglesheets FOR EACH ROW EXECUTE FUNCTION public.apigs_touch_updated_at();


--
-- Name: sessions trg_sessions_seen; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sessions_seen BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.trg_sessions_seen();


--
-- Name: usuarios trg_usuarios_alt; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usuarios_alt BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.trg_usuarios_alt();


--
-- Name: usuarios trg_usuarios_datahoraalt; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usuarios_datahoraalt BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.trg_set_datahoraalt();


--
-- Name: cliforemp cliforemp_chaveclifor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliforemp
    ADD CONSTRAINT cliforemp_chaveclifor_fkey FOREIGN KEY (chaveclifor) REFERENCES public.clifor(chave) ON DELETE RESTRICT;


--
-- Name: cliforemp cliforemp_chaveemp_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliforemp
    ADD CONSTRAINT cliforemp_chaveemp_fkey FOREIGN KEY (chaveemp) REFERENCES public.empresa(chave) ON DELETE RESTRICT;


--
-- Name: entradas entradas_chaveclifor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entradas
    ADD CONSTRAINT entradas_chaveclifor_fkey FOREIGN KEY (chaveclifor) REFERENCES public.clifor(chave) ON DELETE RESTRICT;


--
-- Name: itementradaprod itementradaprod_chaveentrada_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itementradaprod
    ADD CONSTRAINT itementradaprod_chaveentrada_fkey FOREIGN KEY (chaveentrada) REFERENCES public.entradas(chave) ON DELETE CASCADE;


--
-- Name: itementradaprod itementradaprod_chaveproduto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itementradaprod
    ADD CONSTRAINT itementradaprod_chaveproduto_fkey FOREIGN KEY (chaveproduto) REFERENCES public.produtos(chave) ON DELETE RESTRICT;


--
-- Name: itementradaserv itementradaserv_chaveentrada_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itementradaserv
    ADD CONSTRAINT itementradaserv_chaveentrada_fkey FOREIGN KEY (chaveentrada) REFERENCES public.entradas(chave) ON DELETE CASCADE;


--
-- Name: itementradaserv itementradaserv_chaveservico_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itementradaserv
    ADD CONSTRAINT itementradaserv_chaveservico_fkey FOREIGN KEY (chaveservico) REFERENCES public.servicos(chave) ON DELETE RESTRICT;


--
-- Name: itemsaidaprod itemsaidaprod_chaveproduto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itemsaidaprod
    ADD CONSTRAINT itemsaidaprod_chaveproduto_fkey FOREIGN KEY (chaveproduto) REFERENCES public.produtos(chave) ON DELETE RESTRICT;


--
-- Name: itemsaidaprod itemsaidaprod_chavesaida_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itemsaidaprod
    ADD CONSTRAINT itemsaidaprod_chavesaida_fkey FOREIGN KEY (chavesaida) REFERENCES public.saidas(chave) ON DELETE CASCADE;


--
-- Name: itemsaidaserv itemsaidaserv_chavesaida_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itemsaidaserv
    ADD CONSTRAINT itemsaidaserv_chavesaida_fkey FOREIGN KEY (chavesaida) REFERENCES public.saidas(chave) ON DELETE CASCADE;


--
-- Name: itemsaidaserv itemsaidaserv_chaveservico_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itemsaidaserv
    ADD CONSTRAINT itemsaidaserv_chaveservico_fkey FOREIGN KEY (chaveservico) REFERENCES public.servicos(chave) ON DELETE RESTRICT;


--
-- Name: pedido_itens pedido_itens_chavepedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_itens
    ADD CONSTRAINT pedido_itens_chavepedido_fkey FOREIGN KEY (chavepedido) REFERENCES public.pedidos(chave) ON DELETE CASCADE;


--
-- Name: pedido_itens pedido_itens_chaveproduto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_itens
    ADD CONSTRAINT pedido_itens_chaveproduto_fkey FOREIGN KEY (chaveproduto) REFERENCES public.produtos(chave) ON DELETE RESTRICT;


--
-- Name: pedido_log pedido_log_chavepedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_log
    ADD CONSTRAINT pedido_log_chavepedido_fkey FOREIGN KEY (chavepedido) REFERENCES public.pedidos(chave) ON DELETE CASCADE;


--
-- Name: pedido_pagamentos pedido_pagamentos_chavepedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_pagamentos
    ADD CONSTRAINT pedido_pagamentos_chavepedido_fkey FOREIGN KEY (chavepedido) REFERENCES public.pedidos(chave) ON DELETE CASCADE;


--
-- Name: pedidos pedidos_chaveclifor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_chaveclifor_fkey FOREIGN KEY (chaveclifor) REFERENCES public.clifor(chave) ON DELETE SET NULL;


--
-- Name: pedidos pedidos_chaveemp_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_chaveemp_fkey FOREIGN KEY (chaveemp) REFERENCES public.empresa(chave) ON DELETE SET NULL;


--
-- Name: produtoestoque produtoestoque_chaveitementrada_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtoestoque
    ADD CONSTRAINT produtoestoque_chaveitementrada_fk FOREIGN KEY (chaveitementrada) REFERENCES public.itementradaprod(chave) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: produtoestoque produtoestoque_chaveproduto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtoestoque
    ADD CONSTRAINT produtoestoque_chaveproduto_fkey FOREIGN KEY (chaveproduto) REFERENCES public.produtos(chave) ON DELETE CASCADE;


--
-- Name: produtos produtos_chaveemp_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_chaveemp_fkey FOREIGN KEY (chaveemp) REFERENCES public.empresa(chave) ON DELETE SET NULL;


--
-- Name: saidas saidas_chaveclifor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saidas
    ADD CONSTRAINT saidas_chaveclifor_fkey FOREIGN KEY (chaveclifor) REFERENCES public.clifor(chave) ON DELETE RESTRICT;


--
-- Name: servicoestoque servicoestoque_chaveitementradaserv_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicoestoque
    ADD CONSTRAINT servicoestoque_chaveitementradaserv_fk FOREIGN KEY (chaveitementradaserv) REFERENCES public.itementradaserv(chave) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: servicoestoque servicoestoque_chaveservico_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicoestoque
    ADD CONSTRAINT servicoestoque_chaveservico_fkey FOREIGN KEY (chaveservico) REFERENCES public.servicos(chave) ON DELETE CASCADE;


--
-- Name: servicos servicos_chaveemp_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos
    ADD CONSTRAINT servicos_chaveemp_fkey FOREIGN KEY (chaveemp) REFERENCES public.empresa(chave) ON DELETE SET NULL;


--
-- Name: sessions sessions_chaveusuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_chaveusuario_fkey FOREIGN KEY (chaveusuario) REFERENCES public.usuarios(chave) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

