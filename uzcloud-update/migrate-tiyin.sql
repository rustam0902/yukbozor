-- Миграция денежных полей с integer на numeric(15,2) для поддержки тийнов
-- ВНИМАНИЕ: Выполняйте на РАБОЧЕЙ базе только после резервного копирования!

-- 1. Таблица orders
ALTER TABLE orders 
  ALTER COLUMN price_with_vat TYPE numeric(15,2) USING price_with_vat::numeric(15,2),
  ALTER COLUMN customer_blocked_collateral TYPE numeric(15,2) USING COALESCE(customer_blocked_collateral, 0)::numeric(15,2);

-- 2. Таблица offers
ALTER TABLE offers 
  ALTER COLUMN price TYPE numeric(15,2) USING price::numeric(15,2),
  ALTER COLUMN price_without_vat TYPE numeric(15,2) USING price_without_vat::numeric(15,2),
  ALTER COLUMN blocked_amount TYPE numeric(15,2) USING blocked_amount::numeric(15,2),
  ALTER COLUMN blocked_commission_amount TYPE numeric(15,2) USING COALESCE(blocked_commission_amount, 0)::numeric(15,2);

-- 3. Таблица contracts
ALTER TABLE contracts 
  ALTER COLUMN customer_prepayment_blocked TYPE numeric(15,2) USING COALESCE(customer_prepayment_blocked, 0)::numeric(15,2);

-- 4. Таблица deposits
ALTER TABLE deposits 
  ALTER COLUMN balance TYPE numeric(15,2) USING COALESCE(balance, 0)::numeric(15,2),
  ALTER COLUMN blocked TYPE numeric(15,2) USING COALESCE(blocked, 0)::numeric(15,2);

-- 5. Таблица deposit_transactions
ALTER TABLE deposit_transactions 
  ALTER COLUMN amount TYPE numeric(15,2) USING amount::numeric(15,2);

-- 6. Таблица withdrawal_requests
ALTER TABLE withdrawal_requests 
  ALTER COLUMN amount TYPE numeric(15,2) USING amount::numeric(15,2);

-- 7. Таблица partner_commissions
ALTER TABLE partner_commissions 
  ALTER COLUMN amount TYPE numeric(15,2) USING amount::numeric(15,2);

-- 8. Таблица order_templates
ALTER TABLE order_templates 
  ALTER COLUMN price_with_vat TYPE numeric(15,2) USING price_with_vat::numeric(15,2);

-- Готово! Все денежные поля теперь поддерживают десятичные значения (тийны)
