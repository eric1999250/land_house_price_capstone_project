import pandas as pd
import re

input_file = r"D:\land_house_price_capstone_project\all_upi_cleaned.csv"
output_file = r"D:\land_house_price_capstone_project\all_upi_cleaned_fixed.csv"

print(" Gukosora file...")

# Soma nk'uko pandas ibigenza - ikoresha quoting
df = pd.read_csv(
    input_file,
    encoding='latin1',
    engine='python',
    on_bad_lines='skip',  # Kura imirongo ibi ibibazo bikomeye
    quotechar='"'         # Kubahiriza quotes - comma mu "..." ntizabazwa
)

# Kura Unnamed columns
df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
df.columns = df.columns.str.strip()

# Kura imirongo ifite area=0 cyangwa nto cyane (bad data)
print(f"Shape mbere: {df.shape}")

df['area_in_meter_square'] = pd.to_numeric(
    df['area_in_meter_square'].astype(str).str.replace(',', '').str.strip(),
    errors='coerce'
)

# Kura imirongo ifite area < 1 m² (ntabwo ari ubutaka nyakuri)
bad_area = df[df['area_in_meter_square'] < 1]
print(f"Imirongo ifite area < 1 m²: {len(bad_area)}")
print(bad_area[['upi', 'area_in_meter_square']].to_string())

df = df[df['area_in_meter_square'] >= 1]
print(f"Shape nyuma: {df.shape}")

# Bika file nshya isukuye
df.to_csv(output_file, index=False, encoding='latin1')
print(f"\n File nshya ibitswe: {output_file}")
print(f"Columns ({len(df.columns)}): {df.columns.tolist()}")