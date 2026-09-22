-- Migration additive equivalente au sync() sans alter/force au demarrage.
-- Alternative manuelle, aucun code secret de portefeuille n'est conserve.
CREATE TABLE IF NOT EXISTS store_payment_accounts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL,
  provider ENUM('mvola', 'orange_money', 'airtel_money') NOT NULL,
  phone VARCHAR(16) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY store_provider (store_id, provider),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);
