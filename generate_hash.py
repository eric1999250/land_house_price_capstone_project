import bcrypt
password = "Eric@!99"
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
print(hashed)


# -- Only these roles are needed
# INSERT INTO roles (name) VALUES 
#     ('admin'),
#     ('district_land_officer'),
#     ('sector_land_officer'),
#     ('notary'),
#     ('buyer_seller')
# ON CONFLICT (name) DO NOTHING;



# -- Clean and simple - just use 'admin'
# INSERT INTO roles (name) VALUES ('admin') ON CONFLICT (name) DO NOTHING;

# -- Your admin user
# INSERT INTO users (
#     full_name,
#     email,
#     password_hash,
#     phone,
#     national_id,
#     sex,
#     role_id,
#     status
# ) VALUES (
#     'UWINEZA Eric',
#     'admin@lpes.rw',
#     '$2b$12$hxFhLaids3mUHdIRmc7ucu95d1tFkoOGwnEdfgu2HTkBdPg.uP.6m',
#     '+250 788 000 000',
#     '1200180012001200',
#     'Male',
#     (SELECT id FROM roles WHERE name = 'admin'),
#     'approved'
# );

#psql postgresql://land_price_db_user:uCYwMtRvFKenEFCjbNlIY0k0rqEJeI6N@dpg-d8en2e8js32c738kv6g0-a.oregon-postgres.render.com/land_price_db