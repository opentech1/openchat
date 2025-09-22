-- Ensure ElectricSQL shadow database exists for schema differencing
CREATE DATABASE openchat_shadow WITH OWNER postgres TEMPLATE template0 ENCODING 'UTF8';
