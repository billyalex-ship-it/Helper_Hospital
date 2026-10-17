CREATE DATABASE IF NOT EXISTS hospital_ms2
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hospital_ms2;

CREATE TABLE IF NOT EXISTS sections (
    section_id INT NOT NULL AUTO_INCREMENT,
    section_name VARCHAR(50) NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (section_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
    user_id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('doctor', 'nurse', 'patient', 'admin', 'visitor', 'reception') NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
    room_id VARCHAR(20) NOT NULL,
    room_name VARCHAR(20) DEFAULT NULL,
    building_location VARCHAR(20) DEFAULT NULL,
    section_id INT DEFAULT NULL,
    PRIMARY KEY (room_id),
    KEY idx_rooms_section_id (section_id),
    CONSTRAINT fk_rooms_section
        FOREIGN KEY (section_id) REFERENCES sections (section_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS doctors (
    doctor_id VARCHAR(20) NOT NULL,
    doc_name VARCHAR(50) DEFAULT NULL,
    speciality VARCHAR(50) DEFAULT NULL,
    phone_number VARCHAR(20) DEFAULT NULL,
    room_id VARCHAR(20) DEFAULT NULL,
    user_id INT DEFAULT NULL,
    PRIMARY KEY (doctor_id),
    UNIQUE KEY uq_doctors_user_id (user_id),
    KEY idx_doctors_room_id (room_id),
    CONSTRAINT fk_doctors_room
        FOREIGN KEY (room_id) REFERENCES rooms (room_id),
    CONSTRAINT fk_doctors_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nurses (
    nurse_id VARCHAR(20) NOT NULL,
    nurse_name VARCHAR(50) DEFAULT NULL,
    speciality VARCHAR(50) DEFAULT NULL,
    phone_number VARCHAR(20) DEFAULT NULL,
    room_id VARCHAR(20) DEFAULT NULL,
    user_id INT DEFAULT NULL,
    PRIMARY KEY (nurse_id),
    UNIQUE KEY uq_nurses_user_id (user_id),
    KEY idx_nurses_room_id (room_id),
    CONSTRAINT fk_nurses_room
        FOREIGN KEY (room_id) REFERENCES rooms (room_id),
    CONSTRAINT fk_nurses_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS patients (
    patient_id VARCHAR(30) NOT NULL,
    patient_name VARCHAR(50) DEFAULT NULL,
    phone_no VARCHAR(20) DEFAULT NULL,
    date_of_birth DATE DEFAULT NULL,
    gender ENUM('male', 'female', 'other') DEFAULT NULL,
    address VARCHAR(255) DEFAULT NULL,
    doctor_id VARCHAR(20) DEFAULT NULL,
    user_id INT DEFAULT NULL,
    PRIMARY KEY (patient_id),
    UNIQUE KEY uq_patients_user_id (user_id),
    KEY idx_patients_doctor_id (doctor_id),
    CONSTRAINT fk_patients_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id),
    CONSTRAINT fk_patients_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS receptionist (
    recep_id VARCHAR(40) NOT NULL,
    phone_no VARCHAR(20) DEFAULT NULL,
    user_id INT DEFAULT NULL,
    PRIMARY KEY (recep_id),
    UNIQUE KEY uq_receptionist_user_id (user_id),
    CONSTRAINT fk_receptionist_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS drugs (
    drug_id VARCHAR(20) NOT NULL,
    drug_name VARCHAR(50) DEFAULT NULL,
    drug_type VARCHAR(50) DEFAULT NULL,
    stock_quantity INT DEFAULT 0,
    unit_price DECIMAL(10, 2) DEFAULT NULL,
    PRIMARY KEY (drug_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS visitors (
    visitor_id INT NOT NULL AUTO_INCREMENT,
    visitor_name VARCHAR(50) DEFAULT NULL,
    phone_no VARCHAR(20) DEFAULT NULL,
    patient_id VARCHAR(30) DEFAULT NULL,
    PRIMARY KEY (visitor_id),
    KEY idx_visitors_patient_id (patient_id),
    CONSTRAINT fk_visitors_patient
        FOREIGN KEY (patient_id) REFERENCES patients (patient_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointments (
    appointment_id INT NOT NULL AUTO_INCREMENT,
    patient_id VARCHAR(30) NOT NULL,
    doctor_id VARCHAR(20) NOT NULL,
    room_id VARCHAR(20) DEFAULT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status ENUM('scheduled', 'completed', 'cancelled', 'no_show') DEFAULT 'scheduled',
    reason VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (appointment_id),
    KEY idx_appointments_patient_id (patient_id),
    KEY idx_appointments_doctor_id (doctor_id),
    KEY idx_appointments_room_id (room_id),
    CONSTRAINT fk_appointments_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id),
    CONSTRAINT fk_appointments_patient
        FOREIGN KEY (patient_id) REFERENCES patients (patient_id),
    CONSTRAINT fk_appointments_room
        FOREIGN KEY (room_id) REFERENCES rooms (room_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bills (
    bill_id INT NOT NULL AUTO_INCREMENT,
    patient_id VARCHAR(30) NOT NULL,
    appointment_id INT DEFAULT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
    issue_date DATE NOT NULL,
    payment_date DATE DEFAULT NULL,
    payment_method ENUM('cash', 'mpesa', 'card', 'insurance') DEFAULT NULL,
    PRIMARY KEY (bill_id),
    KEY idx_bills_patient_id (patient_id),
    KEY idx_bills_appointment_id (appointment_id),
    CONSTRAINT fk_bills_appointment
        FOREIGN KEY (appointment_id) REFERENCES appointments (appointment_id),
    CONSTRAINT fk_bills_patient
        FOREIGN KEY (patient_id) REFERENCES patients (patient_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescriptions (
    prescription_id INT NOT NULL AUTO_INCREMENT,
    patient_id VARCHAR(30) NOT NULL,
    doctor_id VARCHAR(20) NOT NULL,
    appointment_id INT DEFAULT NULL,
    date_prescribed DATE NOT NULL,
    notes VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (prescription_id),
    KEY idx_prescriptions_patient_id (patient_id),
    KEY idx_prescriptions_doctor_id (doctor_id),
    KEY idx_prescriptions_appointment_id (appointment_id),
    CONSTRAINT fk_prescriptions_appointment
        FOREIGN KEY (appointment_id) REFERENCES appointments (appointment_id),
    CONSTRAINT fk_prescriptions_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id),
    CONSTRAINT fk_prescriptions_patient
        FOREIGN KEY (patient_id) REFERENCES patients (patient_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescription_items (
    prescription_id INT NOT NULL,
    drug_id VARCHAR(20) NOT NULL,
    dosage VARCHAR(50) DEFAULT NULL,
    frequency VARCHAR(50) DEFAULT NULL,
    duration VARCHAR(50) DEFAULT NULL,
    PRIMARY KEY (prescription_id, drug_id),
    KEY idx_prescription_items_drug_id (drug_id),
    CONSTRAINT fk_prescription_items_drug
        FOREIGN KEY (drug_id) REFERENCES drugs (drug_id),
    CONSTRAINT fk_prescription_items_prescription
        FOREIGN KEY (prescription_id) REFERENCES prescriptions (prescription_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medical_records (
    record_id INT NOT NULL AUTO_INCREMENT,
    patient_id VARCHAR(30) NOT NULL,
    doctor_id VARCHAR(20) NOT NULL,
    appointment_id INT DEFAULT NULL,
    diagnosis VARCHAR(255) DEFAULT NULL,
    treatment_notes TEXT,
    record_date DATE NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (record_id),
    KEY idx_medical_records_patient_id (patient_id),
    KEY idx_medical_records_doctor_id (doctor_id),
    KEY idx_medical_records_appointment_id (appointment_id),
    CONSTRAINT fk_records_appointment
        FOREIGN KEY (appointment_id) REFERENCES appointments (appointment_id),
    CONSTRAINT fk_records_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id),
    CONSTRAINT fk_records_patient
        FOREIGN KEY (patient_id) REFERENCES patients (patient_id)
) ENGINE=InnoDB;
