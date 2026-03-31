CREATE TABLE IF NOT EXISTS public."settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public."app_settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public."wood_types" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "name_en" TEXT,
  "icon" TEXT,
  "sort_order" INTEGER DEFAULT 0,
  "code" TEXT,
  "unit" TEXT DEFAULT 'm3'::text,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  "thickness_mode" VARCHAR(10) DEFAULT 'fixed'::character varying
);

CREATE TABLE IF NOT EXISTS public."attributes" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "groupable" BOOLEAN DEFAULT false,
  "values" TEXT,
  "range_groups" JSONB,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."wood_config" (
  "wood_id" TEXT NOT NULL,
  "attr_id" TEXT NOT NULL,
  "selected_values" TEXT,
  "is_header" BOOLEAN DEFAULT false,
  "range_groups" JSONB,
  "price_group_config" JSONB,
  "attr_aliases" JSONB
);

CREATE TABLE IF NOT EXISTS public."prices" (
  "wood_id" TEXT NOT NULL,
  "sku_key" TEXT NOT NULL,
  "price" NUMERIC,
  "updated_date" DATE,
  "updated_by" TEXT,
  "cost_price" NUMERIC,
  "price2" NUMERIC
);

CREATE TABLE IF NOT EXISTS public."change_log" (
  "id" SERIAL NOT NULL,
  "timestamp" TIMESTAMPTZ DEFAULT now(),
  "wood_id" TEXT,
  "sku_key" TEXT,
  "old_price" NUMERIC,
  "new_price" NUMERIC,
  "reason" TEXT,
  "changed_by" TEXT
);

CREATE TABLE IF NOT EXISTS public."suppliers" (
  "id" BIGSERIAL NOT NULL,
  "ncc_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "configurable" BOOLEAN DEFAULT false,
  "created_by" TEXT,
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."customers" (
  "id" SERIAL NOT NULL,
  "customer_code" TEXT,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "delivery_address" TEXT,
  "phone1" TEXT NOT NULL,
  "phone2" TEXT,
  "company_name" TEXT,
  "interested_wood_types" JSONB DEFAULT '[]'::jsonb,
  "product_description" TEXT,
  "debt_limit" NUMERIC DEFAULT 0,
  "debt_days" INTEGER DEFAULT 30,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "salutation" TEXT,
  "age" INTEGER,
  "commune" TEXT,
  "street_address" TEXT,
  "workshop_lat" DOUBLE PRECISION,
  "workshop_lng" DOUBLE PRECISION,
  "department" TEXT,
  "position" TEXT,
  "dob" DATE,
  "nickname" TEXT,
  "products" JSONB DEFAULT '[]'::jsonb,
  "preferences" JSONB DEFAULT '[]'::jsonb,
  "created_by" TEXT,
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."carriers" (
  "id" BIGINT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "active" BOOLEAN DEFAULT true NOT NULL,
  "priority" SMALLINT DEFAULT 1 NOT NULL,
  "service_type" TEXT DEFAULT 'chi_van_chuyen'::text NOT NULL,
  "vehicles" JSONB DEFAULT '[]'::jsonb NOT NULL,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."product_catalog" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER DEFAULT 0,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."preference_catalog" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER DEFAULT 0,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."permission_groups" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT DEFAULT ''::text,
  "icon" TEXT DEFAULT '🔐'::text,
  "color" TEXT DEFAULT '#666'::text,
  "is_system" BOOLEAN DEFAULT false,
  "active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."group_permissions" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "group_id" UUID NOT NULL,
  "permission_key" TEXT NOT NULL,
  "granted" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."users" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "username" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "label" TEXT,
  "active" BOOLEAN DEFAULT true,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  "email" TEXT,
  "phone" TEXT,
  "permission_group_id" UUID,
  "last_login_at" TIMESTAMPTZ,
  "last_login_ip" TEXT,
  "notes" TEXT
);

CREATE TABLE IF NOT EXISTS public."audit_logs" (
  "id" BIGSERIAL NOT NULL,
  "user_id" UUID,
  "username" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "old_data" JSONB,
  "new_data" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."raw_wood_formulas" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "measurement" TEXT NOT NULL,
  "coeff" NUMERIC,
  "exponent" INTEGER,
  "length_adjust" BOOLEAN DEFAULT false,
  "rounding" TEXT DEFAULT 'ROUND'::text,
  "decimals" INTEGER DEFAULT 3,
  "description" TEXT,
  "sort_order" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."raw_wood_types" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "wood_form" TEXT NOT NULL,
  "icon" TEXT,
  "sort_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "supplier_formula_id" UUID,
  "inspection_formula_id" UUID,
  "unit_type" TEXT DEFAULT 'volume'::text,
  "sale_unit" TEXT DEFAULT 'volume'::text
);

CREATE TABLE IF NOT EXISTS public."wood_conversion_rates" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "rate" NUMERIC NOT NULL,
  "thickness_min" TEXT,
  "notes" TEXT,
  "sort_order" INTEGER DEFAULT 0,
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  "wood_type_id" TEXT
);

CREATE TABLE IF NOT EXISTS public."shipments" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "shipment_code" TEXT NOT NULL,
  "arrival_date" DATE,
  "port_name" TEXT,
  "yard_storage_deadline" DATE,
  "container_storage_deadline" DATE,
  "empty_return_deadline" DATE,
  "carrier_name" TEXT,
  "carrier_phone" TEXT,
  "status" TEXT DEFAULT 'Chờ cập cảng'::text,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "lot_type" TEXT DEFAULT 'sawn'::text,
  "ncc_id" TEXT,
  "eta" DATE,
  "carrier_id" BIGINT,
  "unit_cost_usd" NUMERIC,
  "exchange_rate" NUMERIC,
  "wood_type_id" TEXT,
  "raw_wood_type_id" UUID,
  "name" TEXT
);

CREATE TABLE IF NOT EXISTS public."containers" (
  "id" BIGSERIAL NOT NULL,
  "container_code" TEXT NOT NULL,
  "ncc_id" TEXT,
  "arrival_date" DATE,
  "total_volume" NUMERIC,
  "status" TEXT DEFAULT 'Tạo mới'::text,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "created_by" TEXT,
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  "shipment_id" UUID,
  "cargo_type" TEXT DEFAULT 'sawn'::text,
  "unit_cost_usd" NUMERIC,
  "exchange_rate" NUMERIC,
  "is_standalone" BOOLEAN DEFAULT false,
  "avg_diameter_cm" NUMERIC,
  "avg_width_cm" NUMERIC,
  "weight_unit" TEXT DEFAULT 'm3'::text,
  "ton_to_m3_factor" NUMERIC,
  "remaining_volume" NUMERIC,
  "raw_wood_type_id" UUID,
  "sale_unit_price" NUMERIC,
  "sale_notes" TEXT,
  "images" JSONB DEFAULT '[]'::jsonb,
  "remaining_pieces" INTEGER
);

CREATE TABLE IF NOT EXISTS public."container_items" (
  "id" BIGSERIAL NOT NULL,
  "container_id" BIGINT,
  "wood_id" TEXT,
  "thickness" TEXT,
  "quality" TEXT,
  "volume" NUMERIC,
  "notes" TEXT,
  "item_type" TEXT DEFAULT 'sawn'::text,
  "raw_wood_type_id" UUID,
  "piece_count" INTEGER,
  "actual_volume" NUMERIC,
  "actual_piece_count" INTEGER,
  "shortage_count" INTEGER DEFAULT 0,
  "damaged_count" INTEGER DEFAULT 0,
  "inspection_status" TEXT DEFAULT 'pending'::text,
  "inspection_date" DATE,
  "inspector" TEXT
);

CREATE TABLE IF NOT EXISTS public."raw_wood_packing_list" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "container_id" BIGINT,
  "container_item_id" BIGINT,
  "piece_code" TEXT,
  "length_m" NUMERIC,
  "diameter_cm" NUMERIC,
  "circumference_cm" NUMERIC,
  "width_cm" NUMERIC,
  "thickness_cm" NUMERIC,
  "volume_m3" NUMERIC,
  "quality" TEXT,
  "sort_order" INTEGER DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "weight_kg" NUMERIC,
  "sawing_batch_id" UUID,
  "sawn_date" DATE
);

CREATE TABLE IF NOT EXISTS public."raw_wood_inspection" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "container_id" BIGINT,
  "container_item_id" BIGINT,
  "packing_list_id" UUID,
  "piece_code" TEXT,
  "length_m" NUMERIC,
  "diameter_cm" NUMERIC,
  "circumference_cm" NUMERIC,
  "width_cm" NUMERIC,
  "thickness_cm" NUMERIC,
  "volume_m3" NUMERIC,
  "quality" TEXT,
  "is_missing" BOOLEAN DEFAULT false,
  "is_damaged" BOOLEAN DEFAULT false,
  "is_standalone" BOOLEAN DEFAULT false,
  "status" TEXT DEFAULT 'available'::text,
  "sawmill_batch_id" UUID,
  "sale_order_id" INTEGER,
  "sort_order" INTEGER DEFAULT 0,
  "notes" TEXT,
  "inspection_date" DATE,
  "inspector" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "weight_kg" NUMERIC,
  "sale_unit_price" NUMERIC
);

CREATE TABLE IF NOT EXISTS public."raw_wood_pricing" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "raw_wood_type_id" UUID,
  "quality" TEXT,
  "size_min" NUMERIC,
  "size_max" NUMERIC,
  "unit_price" NUMERIC NOT NULL,
  "price_unit" TEXT DEFAULT 'm3'::text,
  "notes" TEXT,
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."raw_wood_price_config" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "raw_wood_type_id" UUID NOT NULL,
  "formula_type" TEXT NOT NULL,
  "base_price" NUMERIC,
  "measure_variable" TEXT,
  "measure_coefficient" NUMERIC DEFAULT 0.1,
  "quality_config" JSONB,
  "size_tiers" JSONB,
  "volume_discounts" JSONB,
  "sale_modifiers" JSONB,
  "ton_to_m3_ratio" NUMERIC,
  "notes" TEXT,
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  "preview_sizes" JSONB
);

CREATE TABLE IF NOT EXISTS public."raw_wood_withdrawals" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "container_id" BIGINT NOT NULL,
  "type" TEXT NOT NULL,
  "piece_count" INTEGER,
  "weight_kg" NUMERIC,
  "unit" TEXT DEFAULT 'ton'::text,
  "unit_price" NUMERIC,
  "amount" NUMERIC,
  "order_id" INTEGER,
  "sawing_batch_id" UUID,
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."sawing_batches" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "batch_code" TEXT DEFAULT ''::text NOT NULL,
  "wood_id" TEXT NOT NULL,
  "batch_date" DATE DEFAULT CURRENT_DATE NOT NULL,
  "status" TEXT DEFAULT 'sawing'::text NOT NULL,
  "note" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."sawing_items" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" UUID NOT NULL,
  "thickness" TEXT NOT NULL,
  "quality" TEXT NOT NULL,
  "target_volume" NUMERIC DEFAULT 0,
  "done_volume" NUMERIC DEFAULT 0,
  "note" TEXT,
  "priority" TEXT DEFAULT 'normal'::text NOT NULL,
  "sort_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."sawing_daily_logs" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "sawing_item_id" UUID NOT NULL,
  "log_date" DATE DEFAULT CURRENT_DATE NOT NULL,
  "added_volume" NUMERIC NOT NULL,
  "logged_by" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."sawing_round_inputs" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" UUID NOT NULL,
  "input_date" DATE DEFAULT CURRENT_DATE NOT NULL,
  "container_id" BIGINT,
  "log_count" INTEGER DEFAULT 0,
  "volume_m3" NUMERIC DEFAULT 0,
  "round_quality" TEXT,
  "note" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."kiln_batches" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "batch_code" TEXT NOT NULL,
  "kiln_number" INTEGER NOT NULL,
  "entry_date" DATE NOT NULL,
  "expected_exit_date" DATE,
  "actual_exit_date" DATE,
  "status" TEXT DEFAULT 'Đang sấy'::text NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."kiln_items" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" UUID NOT NULL,
  "item_code" TEXT NOT NULL,
  "wood_type_id" TEXT,
  "thickness_cm" NUMERIC NOT NULL,
  "owner_type" TEXT DEFAULT 'company'::text NOT NULL,
  "owner_name" TEXT,
  "weight_kg" NUMERIC DEFAULT 0 NOT NULL,
  "conversion_rate" NUMERIC,
  "volume_m3" NUMERIC DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "quality" TEXT,
  "sawing_item_id" UUID
);

CREATE TABLE IF NOT EXISTS public."unsorted_bundles" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "bundle_code" TEXT NOT NULL,
  "kiln_item_id" UUID,
  "wood_type_id" TEXT,
  "thickness_cm" NUMERIC NOT NULL,
  "owner_type" TEXT DEFAULT 'company'::text,
  "owner_name" TEXT,
  "weight_kg" NUMERIC DEFAULT 0 NOT NULL,
  "volume_m3" NUMERIC DEFAULT 0,
  "status" TEXT DEFAULT 'Chưa xếp'::text NOT NULL,
  "packing_session_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."packing_sessions" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "session_code" TEXT NOT NULL,
  "packing_date" DATE NOT NULL,
  "wood_type_id" TEXT,
  "thickness_cm" NUMERIC,
  "total_input_kg" NUMERIC DEFAULT 0,
  "total_input_m3" NUMERIC DEFAULT 0,
  "status" TEXT DEFAULT 'Đang xếp'::text NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."packing_leftovers" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "leftover_code" TEXT NOT NULL,
  "source_session_id" UUID NOT NULL,
  "wood_type_id" TEXT,
  "thickness_cm" NUMERIC,
  "quality" TEXT,
  "weight_kg" NUMERIC DEFAULT 0,
  "volume_m3" NUMERIC DEFAULT 0,
  "status" TEXT DEFAULT 'Chưa xếp'::text NOT NULL,
  "used_in_session_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."kiln_edit_log" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "kiln_item_id" UUID,
  "action" TEXT NOT NULL,
  "changed_by" TEXT,
  "old_values" JSONB,
  "new_values" JSONB,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."wood_bundles" (
  "id" SERIAL NOT NULL,
  "bundle_code" TEXT NOT NULL,
  "wood_id" TEXT NOT NULL,
  "container_id" INTEGER,
  "sku_key" TEXT NOT NULL,
  "attributes" JSONB DEFAULT '{}'::jsonb NOT NULL,
  "board_count" INTEGER DEFAULT 0 NOT NULL,
  "remaining_boards" INTEGER DEFAULT 0 NOT NULL,
  "volume" NUMERIC DEFAULT 0 NOT NULL,
  "remaining_volume" NUMERIC DEFAULT 0 NOT NULL,
  "status" TEXT DEFAULT 'Nguyên kiện'::text NOT NULL,
  "notes" TEXT,
  "qr_code" TEXT,
  "images" TEXT[] DEFAULT '{}'::text[],
  "item_list_images" TEXT[] DEFAULT '{}'::text[],
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  "supplier_bundle_code" TEXT,
  "location" TEXT,
  "raw_measurements" JSONB,
  "manual_group_assignment" BOOLEAN DEFAULT false NOT NULL,
  "unit_price" NUMERIC DEFAULT NULL::numeric,
  "created_by" TEXT,
  "updated_by" TEXT,
  "volume_adjustment" NUMERIC,
  "price_adjustment" JSONB,
  "sawing_batch_id" UUID,
  "packing_session_id" UUID,
  "price_attrs_override" JSONB,
  "price_override_reason" TEXT
);

CREATE TABLE IF NOT EXISTS public."orders" (
  "id" SERIAL NOT NULL,
  "order_code" TEXT,
  "customer_id" INTEGER,
  "status" TEXT DEFAULT 'Đơn hàng mới'::text,
  "payment_status" TEXT DEFAULT 'Chưa thanh toán'::text,
  "payment_date" TIMESTAMPTZ,
  "export_status" TEXT DEFAULT 'Chưa xuất'::text,
  "export_date" TIMESTAMPTZ,
  "export_images" JSONB DEFAULT '[]'::jsonb,
  "subtotal" NUMERIC DEFAULT 0,
  "apply_tax" BOOLEAN DEFAULT true,
  "tax_amount" NUMERIC DEFAULT 0,
  "deposit" NUMERIC DEFAULT 0,
  "debt" NUMERIC DEFAULT 0,
  "total_amount" NUMERIC DEFAULT 0,
  "shipping_type" TEXT DEFAULT 'Gọi xe cho khách'::text,
  "shipping_carrier" TEXT,
  "shipping_fee" NUMERIC DEFAULT 0,
  "driver_name" TEXT,
  "driver_phone" TEXT,
  "delivery_address" TEXT,
  "license_plate" TEXT,
  "estimated_arrival" TEXT,
  "shipping_notes" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "created_by" TEXT,
  "updated_by" TEXT,
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  "cancelled_at" TIMESTAMPTZ,
  "cancelled_by" TEXT,
  "cancel_reason" TEXT,
  "paid_amount" NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."order_items" (
  "id" SERIAL NOT NULL,
  "order_id" INTEGER,
  "bundle_id" INTEGER,
  "bundle_code" TEXT,
  "wood_id" TEXT,
  "sku_key" TEXT,
  "attributes" JSONB DEFAULT '{}'::jsonb,
  "board_count" INTEGER DEFAULT 0,
  "volume" NUMERIC DEFAULT 0,
  "unit" TEXT DEFAULT 'm3'::text,
  "unit_price" NUMERIC,
  "list_price" NUMERIC,
  "amount" NUMERIC DEFAULT 0,
  "notes" TEXT,
  "supplier_bundle_code" TEXT,
  "list_price2" NUMERIC DEFAULT NULL::numeric,
  "item_type" TEXT DEFAULT 'bundle'::text,
  "inspection_item_id" UUID,
  "container_id" BIGINT,
  "raw_wood_data" JSONB,
  "sale_volume" NUMERIC,
  "sale_unit" TEXT,
  "ref_volume" NUMERIC
);

CREATE TABLE IF NOT EXISTS public."order_services" (
  "id" SERIAL NOT NULL,
  "order_id" INTEGER,
  "description" TEXT,
  "amount" NUMERIC DEFAULT 0,
  "payload" JSONB
);

CREATE TABLE IF NOT EXISTS public."payment_records" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "order_id" INTEGER NOT NULL,
  "customer_id" INTEGER,
  "amount" NUMERIC NOT NULL,
  "method" TEXT DEFAULT 'Tiền mặt'::text NOT NULL,
  "paid_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "note" TEXT,
  "paid_by" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "discount" NUMERIC DEFAULT 0 NOT NULL,
  "discount_note" TEXT,
  "discount_status" TEXT DEFAULT 'none'::text NOT NULL,
  "voided" BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."bank_accounts" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "bank_name" TEXT NOT NULL,
  "account_number" TEXT NOT NULL,
  "account_name" TEXT NOT NULL,
  "bin" TEXT NOT NULL,
  "is_default" BOOLEAN DEFAULT false,
  "active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."bank_transactions" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "reference_code" TEXT NOT NULL,
  "gateway" TEXT,
  "account_number" TEXT,
  "amount" NUMERIC NOT NULL,
  "content" TEXT,
  "description" TEXT,
  "transaction_date" TIMESTAMPTZ,
  "transfer_type" TEXT DEFAULT 'in'::text,
  "code" TEXT,
  "raw_data" JSONB,
  "parsed_order_code" TEXT,
  "matched_order_id" INTEGER,
  "payment_record_id" UUID,
  "match_status" TEXT DEFAULT 'pending'::text NOT NULL,
  "match_note" TEXT,
  "matched_by" TEXT,
  "matched_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."customer_credits" (
  "id" SERIAL NOT NULL,
  "customer_id" INTEGER NOT NULL,
  "amount" NUMERIC NOT NULL,
  "remaining" NUMERIC NOT NULL,
  "source_order_id" INTEGER,
  "reason" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "used_by_orders" JSONB DEFAULT '[]'::jsonb,
  "source_type" TEXT DEFAULT 'cancelled_order'::text,
  "source_transaction_id" UUID,
  "status" TEXT DEFAULT 'available'::text,
  "created_by" TEXT
);

CREATE TABLE IF NOT EXISTS public."supplier_wood_assignments" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "supplier_ncc_id" TEXT NOT NULL,
  "product_type" TEXT NOT NULL,
  "raw_wood_type_id" UUID,
  "sawn_wood_id" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now()
);
