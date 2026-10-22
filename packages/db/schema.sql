-- Esquema de Base de Datos - Brizo Logistics
-- Compatible con PostgreSQL y Supabase

-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150),
    rol VARCHAR(30) NOT NULL CHECK (rol IN ('CLIENTE', 'ADMIN', 'AGENTE', 'AUDITOR')),
    portal_permitido VARCHAR(20) NOT NULL CHECK (portal_permitido IN ('CLIENTE', 'ADMIN', 'ADUANAS')),
    saldo NUMERIC(10, 2) DEFAULT 3500.00,
    saldo_disponible NUMERIC(10, 2) DEFAULT 3500.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS saldo NUMERIC(10, 2) DEFAULT 3500.00;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS saldo_disponible NUMERIC(10, 2) DEFAULT 3500.00;

-- 2. Tabla de Buques
CREATE TABLE IF NOT EXISTS buques (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'Atracado',
    fase_embarque VARCHAR(50) DEFAULT 'CREADO',
    viaje_codigo VARCHAR(50) DEFAULT 'VIAJE-001',
    duracion_subasta_min INT DEFAULT 5,
    duracion_aduanas_min INT DEFAULT 3,
    fin_subasta TIMESTAMPTZ,
    fin_aduanas TIMESTAMPTZ,
    subasta_iniciada_en TIMESTAMPTZ,
    aduanas_iniciada_en TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE buques ADD COLUMN IF NOT EXISTS fase_embarque VARCHAR(50) DEFAULT 'CREADO';
ALTER TABLE buques ADD COLUMN IF NOT EXISTS viaje_codigo VARCHAR(50) DEFAULT 'VIAJE-001';
ALTER TABLE buques ADD COLUMN IF NOT EXISTS duracion_subasta_min INT DEFAULT 5;
ALTER TABLE buques ADD COLUMN IF NOT EXISTS duracion_aduanas_min INT DEFAULT 3;
ALTER TABLE buques ADD COLUMN IF NOT EXISTS fin_subasta TIMESTAMPTZ;
ALTER TABLE buques ADD COLUMN IF NOT EXISTS fin_aduanas TIMESTAMPTZ;
ALTER TABLE buques ADD COLUMN IF NOT EXISTS subasta_iniciada_en TIMESTAMPTZ;
ALTER TABLE buques ADD COLUMN IF NOT EXISTS aduanas_iniciada_en TIMESTAMPTZ;

-- 3. Tabla de Espacios / Contenedores (Nomenclatura ISO y Sistema Metrico Decimal)
CREATE TABLE IF NOT EXISTS contenedores (
    id VARCHAR(50) PRIMARY KEY,
    buque_id VARCHAR(50) REFERENCES buques(id) ON DELETE CASCADE,
    tipo VARCHAR(100) NOT NULL,
    capacidad_teu INT DEFAULT 1,
    peso_max_ton NUMERIC(6, 2) DEFAULT 28.00,
    volumen_m3 NUMERIC(6, 2) DEFAULT 33.20,
    especificaciones TEXT DEFAULT 'Carga general estandar',
    base NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Pujas / Ofertas (con Contenido Declarado, Destino y Viaje Asignado)
CREATE TABLE IF NOT EXISTS pujas (
    id VARCHAR(50) PRIMARY KEY,
    contenedor_id VARCHAR(50) REFERENCES contenedores(id) ON DELETE CASCADE,
    cliente_nombre VARCHAR(150) NOT NULL,
    contenido_declarado TEXT NOT NULL DEFAULT 'Carga general declarada',
    puerto_destino VARCHAR(150) NOT NULL DEFAULT 'Puerto de Rotterdam (Países Bajos) [NLRTM]',
    monto NUMERIC(10, 2) NOT NULL,
    estado VARCHAR(30) DEFAULT 'activa' CHECK (estado IN ('activa', 'bloqueada', 'adjudicada')),
    viaje_codigo VARCHAR(50) DEFAULT 'VIAJE-001',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pujas ADD COLUMN IF NOT EXISTS viaje_codigo VARCHAR(50) DEFAULT 'VIAJE-001';
ALTER TABLE pujas ADD COLUMN IF NOT EXISTS puerto_destino VARCHAR(150) DEFAULT 'Puerto de Rotterdam (Países Bajos) [NLRTM]';

-- 5. Tabla de Bloqueos Aduaneros
CREATE TABLE IF NOT EXISTS bloqueos (
    id SERIAL PRIMARY KEY,
    puja_id VARCHAR(50) REFERENCES pujas(id) ON DELETE CASCADE,
    motivo TEXT NOT NULL,
    auditor VARCHAR(100) DEFAULT 'Inspector Aduanero',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buque Principal
INSERT INTO buques (id, nombre, estado, fase_embarque)
VALUES ('EMERALD-ACE', 'Emerald Ace', 'Atracado', 'CREADO')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

-- Flota Oficial de 20 Contenedores (Completamente en Español y Sistema Metrico)
INSERT INTO contenedores (id, buque_id, tipo, capacidad_teu, peso_max_ton, volumen_m3, especificaciones, base)
VALUES
    ('MSKU-748291-0', 'EMERALD-ACE', 'Contenedor Seco Estandar (6 metros)', 1, 28.00, 33.20, 'Mercancia general no perecedera. Longitud: 6,06 m. Ancho: 2,44 m. Altura: 2,59 m.', 600.00),
    ('MSKU-748292-6', 'EMERALD-ACE', 'Contenedor Seco Estandar (6 metros)', 1, 28.00, 33.20, 'Mercancia manufacturada, granos secos en sacos. Carga maxima util: 28,0 toneladas.', 600.00),
    ('MSKU-892103-4', 'EMERALD-ACE', 'Contenedor Seco Gran Capacidad (12 metros High Cube)', 2, 28.50, 76.40, 'Altura extendida a 2,90 m. Ideal para mercancia voluminosa y bienes de consumo.', 1100.00),
    ('MSKU-892104-0', 'EMERALD-ACE', 'Contenedor Seco Gran Capacidad (12 metros High Cube)', 2, 28.50, 76.40, 'Volumen util de 76,4 metros cubicos para paqueteria o textiles ligeros.', 1100.00),
    ('MSKU-892105-5', 'EMERALD-ACE', 'Contenedor Seco Gran Capacidad (12 metros High Cube)', 2, 28.50, 76.40, 'Carga de alto volumen. Capacidad maxima bruta: 28,5 toneladas metricas.', 1100.00),
    ('CMAU-481920-3', 'EMERALD-ACE', 'Contenedor Refrigerado Gran Capacidad (12 metros High Cube)', 2, 29.00, 67.30, 'Rango termico de -30 C a +30 C. Control automatico de atmosfera y humedad.', 1600.00),
    ('CMAU-481921-9', 'EMERALD-ACE', 'Contenedor Refrigerado Gran Capacidad (12 metros High Cube)', 2, 29.00, 67.30, 'Rango termico de -30 C a +30 C. Diseñado para carnes congeladas, mariscos y pescados.', 1600.00),
    ('CMAU-481922-4', 'EMERALD-ACE', 'Contenedor Refrigerado Estandar (6 metros)', 1, 22.00, 28.30, 'Rango termico de -25 C a +25 C. Especializado en productos farmaceuticos y vacunas.', 1200.00),
    ('CMAU-481923-0', 'EMERALD-ACE', 'Contenedor Refrigerado Estandar (6 metros)', 1, 22.00, 28.30, 'Rango termico de -25 C a +25 C. Camara frigorifica para frutas frescas y hortalizas.', 1200.00),
    ('HLXU-309182-7', 'EMERALD-ACE', 'Contenedor para Carga Peligrosa IMO (6 metros)', 1, 24.00, 32.80, 'Mercancias peligrosas Clase 3 y 8 (Liquidos inflamables y corrosivos). Homologacion IMO.', 1800.00),
    ('HLXU-309183-2', 'EMERALD-ACE', 'Contenedor para Carga Peligrosa IMO (6 metros)', 1, 24.00, 32.80, 'Sustancias quimicas peligrosas. Requiere hoja de seguridad y rotulacion visible.', 1800.00),
    ('HLXU-309184-8', 'EMERALD-ACE', 'Contenedor para Carga Peligrosa IMO (12 metros)', 2, 26.00, 65.00, 'Solidos inflamables y sustancias toxicas. Sistema de ventilacion forzada en bodega.', 2200.00),
    ('TGHU-918273-1', 'EMERALD-ACE', 'Contenedor Cisterna ISO (6 metros)', 1, 25.00, 26.00, 'Liquidos a granel de grado industrial o quimico. Capacidad total: 26.000 litros.', 2000.00),
    ('TGHU-918274-7', 'EMERALD-ACE', 'Contenedor Cisterna ISO (6 metros)', 1, 25.00, 26.00, 'Liquidos alimenticios (aceites vegetales, concentrados). Tanque de acero inoxidable 316.', 2000.00),
    ('MEDU-551029-4', 'EMERALD-ACE', 'Contenedor de Techo Abierto con Lona (12 metros)', 2, 30.00, 65.50, 'Lona desmontable e impermeable. Carga vertical mediante grua. Maquinaria pesada o tuberias.', 1500.00),
    ('MEDU-551030-8', 'EMERALD-ACE', 'Contenedor de Techo Abierto con Lona (6 metros)', 1, 25.00, 32.00, 'Carga superior para maquinaria de altura irregular o estructuras metalicas.', 1000.00),
    ('MEDU-662041-0', 'EMERALD-ACE', 'Contenedor Plataforma Abierta Flat Rack (12 metros)', 2, 45.00, 55.00, 'Laterales abatibles para carga sobredimensionada, vehiculos pesados o calderas.', 1900.00),
    ('MEDU-662042-6', 'EMERALD-ACE', 'Contenedor Plataforma Abierta Flat Rack (6 metros)', 1, 31.00, 27.00, 'Carga pesada no estandarizada con puntos de amarre y trincaje de alta resistencia.', 1400.00),
    ('SUDU-128394-5', 'EMERALD-ACE', 'Contenedor Seco Estandar (6 metros)', 1, 28.00, 33.20, 'Mercancia general paletizada. Puertas con apertura total de 270 grados.', 650.00),
    ('SUDU-128395-0', 'EMERALD-ACE', 'Contenedor Seco Gran Capacidad (12 metros High Cube)', 2, 28.50, 76.40, 'Electrodomesticos, mobiliario o manufacturas en cajas de carton apiladas.', 1150.00)
ON CONFLICT (id) DO UPDATE SET 
    tipo = EXCLUDED.tipo,
    capacidad_teu = EXCLUDED.capacidad_teu,
    peso_max_ton = EXCLUDED.peso_max_ton,
    volumen_m3 = EXCLUDED.volumen_m3,
    especificaciones = EXCLUDED.especificaciones,
    base = EXCLUDED.base;
