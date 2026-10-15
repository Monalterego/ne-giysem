


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."combos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "score" numeric(5,2),
    "occasion" "text",
    "worn_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "planned_for" "date",
    CONSTRAINT "combos_score_check" CHECK ((("score" >= (0)::numeric) AND ("score" <= (100)::numeric)))
);


ALTER TABLE "public"."combos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorite_combos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "signature" "text" NOT NULL,
    "item_ids" "jsonb" NOT NULL,
    "score" integer,
    "occasion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favorite_combos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "age_range" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "height" integer,
    "age" integer,
    "body_type" "text",
    "skin_tone" "text",
    "hair_color" "text",
    "hair_length" "text",
    "hair_type" "text",
    "virtual_model_renders" integer DEFAULT 0 NOT NULL,
    "avatar_url" "text",
    "mannequin_url" "text",
    "weight" integer,
    CONSTRAINT "profiles_age_range_check" CHECK (("age_range" = ANY (ARRAY['18-24'::"text", '25-34'::"text", '35-44'::"text", '45-54'::"text", '55+'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."style_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "styles" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "color_palette" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."style_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wardrobe_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "subcategory" "text",
    "colors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "pattern" "text",
    "season" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "fabric" "text",
    "image_url" "text",
    "processed_image_url" "text",
    "brand" "text",
    "price" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "item_name" "text",
    "fit" "text",
    "neckline" "text",
    "sleeve_length" "text",
    "details" "jsonb" DEFAULT '[]'::"jsonb",
    "signals" "jsonb" DEFAULT '[]'::"jsonb",
    "thumb_url" "text"
);


ALTER TABLE "public"."wardrobe_items" OWNER TO "postgres";


ALTER TABLE ONLY "public"."combos"
    ADD CONSTRAINT "combos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorite_combos"
    ADD CONSTRAINT "favorite_combos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorite_combos"
    ADD CONSTRAINT "favorite_combos_user_id_signature_key" UNIQUE ("user_id", "signature");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."style_profiles"
    ADD CONSTRAINT "style_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."style_profiles"
    ADD CONSTRAINT "style_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."wardrobe_items"
    ADD CONSTRAINT "wardrobe_items_pkey" PRIMARY KEY ("id");



CREATE INDEX "combos_planned_for_idx" ON "public"."combos" USING "btree" ("user_id", "planned_for");



CREATE INDEX "idx_combos_occasion" ON "public"."combos" USING "btree" ("occasion");



CREATE INDEX "idx_combos_user_id" ON "public"."combos" USING "btree" ("user_id");



CREATE INDEX "idx_wardrobe_items_category" ON "public"."wardrobe_items" USING "btree" ("category");



CREATE INDEX "idx_wardrobe_items_user_id" ON "public"."wardrobe_items" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."combos"
    ADD CONSTRAINT "combos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorite_combos"
    ADD CONSTRAINT "favorite_combos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."style_profiles"
    ADD CONSTRAINT "style_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wardrobe_items"
    ADD CONSTRAINT "wardrobe_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Kullanici kendi dolap parcalarini ekleyebilir" ON "public"."wardrobe_items" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Kullanici kendi dolap parcalarini guncelleyebilir" ON "public"."wardrobe_items" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Kullanici kendi dolap parcalarini okuyabilir" ON "public"."wardrobe_items" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Kullanici kendi dolap parcalarini silebilir" ON "public"."wardrobe_items" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Kullanici kendi kombinlerini ekleyebilir" ON "public"."combos" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Kullanici kendi kombinlerini guncelleyebilir" ON "public"."combos" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Kullanici kendi kombinlerini okuyabilir" ON "public"."combos" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Kullanici kendi kombinlerini silebilir" ON "public"."combos" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Kullanici kendi profilini ekleyebilir" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Kullanici kendi profilini guncelleyebilir" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Kullanici kendi profilini okuyabilir" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Kullanici kendi stil profilini ekleyebilir" ON "public"."style_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Kullanici kendi stil profilini guncelleyebilir" ON "public"."style_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Kullanici kendi stil profilini okuyabilir" ON "public"."style_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Kullanici kendi stil profilini silebilir" ON "public"."style_profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."combos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "favori: kendi kaydını ekle" ON "public"."favorite_combos" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "favori: kendi kaydını sil" ON "public"."favorite_combos" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "favori: kendi kayıtlarını oku" ON "public"."favorite_combos" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."favorite_combos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."style_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wardrobe_items" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON TABLE "public"."combos" TO "anon";
GRANT ALL ON TABLE "public"."combos" TO "authenticated";
GRANT ALL ON TABLE "public"."combos" TO "service_role";



GRANT ALL ON TABLE "public"."favorite_combos" TO "anon";
GRANT ALL ON TABLE "public"."favorite_combos" TO "authenticated";
GRANT ALL ON TABLE "public"."favorite_combos" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."style_profiles" TO "anon";
GRANT ALL ON TABLE "public"."style_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."style_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."wardrobe_items" TO "anon";
GRANT ALL ON TABLE "public"."wardrobe_items" TO "authenticated";
GRANT ALL ON TABLE "public"."wardrobe_items" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







