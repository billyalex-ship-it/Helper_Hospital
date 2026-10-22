
const express = require("express");
const path = require("path");
const app = express();
const session = require("express-session");
const port = 3000;
const bcrypt = require("bcryptjs");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));


// session management
app.use(session({
    secret: 'jwdvnjnjnkmkzmkzaqwqworou',
    resave: false,
    saveUninitialized: true,
}));
//registering middlewares
app.use(express.urlencoded({ extended : true}));
//// authorization middleware
app.use((req, res, next) => {
const user = req.session.user;
res.locals.isAdmin = user ? user.role === "admin" : false;
    res.locals.user = user || null;
    next();
});


// connect to the database
const mysql = require("mysql2");
const dbConnection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Billy@6776",
    database: "hospital_ms2",
    port:3307
});

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== "admin") {
        res.status(403).send("Unauthorized access");
        return;
    }
    next();
}

function requireAdminOrReception(req, res, next) {
    if (!req.session.user || !["admin", "reception"].includes(req.session.user.role)) {
        res.status(403).send("Unauthorized access");
        return;
    }
    next();
}

function requireDoctor(req, res, next) {
    if (!req.session.user || req.session.user.role !== "doctor") {
        res.status(403).send("Unauthorized access");
        return;
    }
    next();
}

function getLocalDateString(date = new Date()) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

// helper functions
function groupDoctorsWithPatients(rows) {
    const grouped = {};
    rows.forEach(row => {
        if (!grouped[row.doctor_id]) {
            grouped[row.doctor_id] = {
                doctor_id: row.doctor_id,
                doc_name: row.doc_name,
                speciality: row.speciality,
                phone_number: row.phone_number,
                patients: []
            };
        }
        if (row.patient_id) {
            grouped[row.doctor_id].patients.push({
                patient_id: row.patient_id,
                patient_name: row.patient_name,
                phone_no: row.phone_no,
                gender: row.gender
            });
        }
    });
    return Object.values(grouped);
}


// routes

// Public pages
// Display the home page.
app.get("/",(req,res) =>{
    res.render("index.ejs");
});
// Display the contact page.
app.get("/contact", (req, res) => {
    res.render("contact.ejs");
});

// Authentication
// Display the login page.
//create a get login route
app.get("/login",(req,res) =>{  
       
res.render("login.ejs");
});
// Authenticate a user and start a session.
app.post("/login", (req, res) => {
    const { email, password } = req.body;
    //check if user email exists in the database
    const query = "SELECT * FROM users WHERE email = ?";
    dbConnection.query(query, [email], async (err, results) => {
        if (err) {
            res.status(500).send("Error checking user: " + err.message);
        } else if (results.length > 0) {
            const user = results[0];
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                if (!user.is_approved) {
                    res.status(403).send("Your account is awaiting administrator approval.");
                    return;
                }
                req.session.user = results[0];
                res.redirect("/dashboard");
            } else {
                res.status(401).send("Invalid username or password");
            }
        } else {
            res.status(401).send("Invalid username or password");
        }
    });
});
// Destroy the session and redirect to the home page.
// create a logout endpoint to destroy the session and redirect to the login page
app.get("/logout",(req,res)=>{
    req.session.destroy();
    res.redirect("/");
});

// Dashboards
// Display the dashboard for the authenticated user's role.
// create a get route for dashboard
app.get("/dashboard", async (req, res) => {
    if(!req.session.user){
        res.redirect("/login");
        return;
    }

    try {
        if(req.session.user.role == "admin"){
            const doctorQuery = "SELECT COUNT(*) AS doctorCount FROM doctors";
            const nurseQuery = "SELECT COUNT(*) AS nurseCount FROM nurses";
            const patientQuery = "SELECT COUNT(*) AS patientCount FROM patients";
            const visitorQuery = "SELECT COUNT(*) AS visitorCount FROM visitors";
              const doc_patient = "SELECT d.doctor_id, d.doc_name, d.speciality, d.phone_number, p.patient_id, p.patient_name, p.phone_no, p.gender FROM doctors d  LEFT JOIN patients p ON p.doctor_id = d.doctor_id  ORDER BY d.doctor_id ";
    
    
            const [doctorResult, nurseResult, patientResult, visitorResult, docPatientResult] = await Promise.all([
                dbConnection.promise().query(doctorQuery),
                dbConnection.promise().query(nurseQuery),
                dbConnection.promise().query(patientQuery),
                dbConnection.promise().query(visitorQuery),
                dbConnection.promise().query(doc_patient)
            ]);

            res.render("admindash.ejs", {
                user: req.session.user,
                doctorresult: doctorResult[0][0],
                nurseResult: nurseResult[0][0],
                patientResult: patientResult[0][0],
                visitorResult: visitorResult[0][0],
                docPatientResult: groupDoctorsWithPatients(docPatientResult[0])   
            });
            return;
        } else if (req.session.user.role == "doctor") {
    // find the doctor record belonging to the logged-in user
    const [doctorRows] = await dbConnection.promise().query(
        "SELECT doctor_id, doc_name, speciality, phone_number FROM doctors WHERE user_id = ?",
        [req.session.user.user_id]
    );

    const doctor = doctorRows[0];
    if (!doctor) {
        return res.status(404).send("Doctor profile not found");
    }

    // get only this doctor's patients
    const [patients] = await dbConnection.promise().query(
        "SELECT patient_id, patient_name, phone_no, gender, patient_status FROM patients WHERE doctor_id = ?",
        [doctor.doctor_id]
    );
    const [doctorAppointments] = await dbConnection.promise().query(`
        SELECT a.appointment_id, a.patient_id,
               DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
               TIME_FORMAT(a.appointment_time, '%H:%i') AS appointment_time,
               a.status, a.reason, p.patient_name, p.phone_no
        FROM appointments a
        JOIN patients p ON p.patient_id = a.patient_id
        WHERE a.doctor_id = ?
        ORDER BY a.appointment_date, a.appointment_time
    `, [doctor.doctor_id]);

    res.render("doctordash.ejs", {
        user: req.session.user,
        doctor: doctor,
        patients: patients,
        doctorAppointments: doctorAppointments,
        today: getLocalDateString()
    });
    return;
        } else if(req.session.user.role == "nurse"){
            res.redirect("/nurses");
        }else if(req.session.user.role == "patient"){
            res.redirect("/patients");
        }else if(req.session.user.role == "reception"){
            res.render("receptiondash.ejs",{ user: req.session.user });
        }else{
            res.status(403).send("Unauthorized access");
        }
    } catch(error) {
        console.error(error);
        res.status(500).send("Error rendering dashboard: " + error.message);
    }
});
// Display the patient dashboard after checking for a session.
// create a get route for adding new patients
app.get("/patient-dash",(req,res)=>{
    if(!req.session.user){
        res.redirect("/login");
    }else{
        res.redirect("/patients");
    }
});

// Employee administration
// Display doctors, nurses, receptionists, and users for an admin.
//create a get route for employees
app.get("/employees", async(req,res)=>{
    if(!req.session.user){
        res.redirect("/login");
        return;
    }else if(req.session.user.role !== "admin"){
        res.status(403).send("Unauthorized access");
        return;
    }
   try {
    const docQuery = "SELECT doctor_id, doc_name, speciality, phone_number, room_id, user_id FROM doctors";
    const nurseQuery = "SELECT nurse_id, nurse_name, speciality, phone_number, room_id, user_id FROM nurses";
    const receptionQuery = `
        SELECT r.recep_id, r.phone_no, r.user_id, u.name, u.email
        FROM receptionist r
        LEFT JOIN users u ON u.user_id = r.user_id`;
    const userquery = "SELECT user_id, name, email, role, is_approved FROM users";
    const roomsQuery = "SELECT room_id, room_name FROM rooms";

    const [docResults, nurseResults, receptionResults, userResults, roomsResults] = await Promise.all([
        dbConnection.promise().query(docQuery),
        dbConnection.promise().query(nurseQuery),
        dbConnection.promise().query(receptionQuery),
        dbConnection.promise().query(userquery),
        dbConnection.promise().query(roomsQuery)
    ]);
    res.render("employees.ejs", {
        doctors: docResults[0],
        nurses: nurseResults[0],
        receptionist: receptionResults[0],
        users: userResults[0],
        rooms: roomsResults[0],
        doctorUsers: userResults[0].filter(user =>
            user.is_approved && user.role === "doctor" && !docResults[0].some(doctor => doctor.user_id === user.user_id)
        ),
        nurseUsers: userResults[0].filter(user =>
            user.is_approved && user.role === "nurse" && !nurseResults[0].some(nurse => nurse.user_id === user.user_id)
        ),
        receptionUsers: userResults[0].filter(user =>
            user.is_approved && user.role === "reception" && !receptionResults[0].some(recep => recep.user_id === user.user_id)
        )
    });
}catch(err){
    console.log(err);
    res.status(500).send("Error fetching employee data: " + err.message);
};
});
// Create a user account from the employee directory.
app.post("/add_user", requireAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    const allowedRoles = ["doctor", "nurse", "patient", "admin", "visitor", "reception"];
    if (!name || !email || !password || !allowedRoles.includes(role)) {
        res.status(400).send("Name, email, password, and a valid role are required.");
        return;
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await dbConnection.promise().query(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            [name, email, hashedPassword, role]
        );
        res.redirect("/employees");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error adding user: " + err.message);
    }
});

app.get("/admin/user-approvals", requireAdmin, async (req, res) => {
    try {
        const [pendingUsers] = await dbConnection.promise().query(
            "SELECT user_id, name, email, role, created_at FROM users WHERE is_approved = FALSE ORDER BY created_at, user_id"
        );
        res.render("user-approvals.ejs", {
            user: req.session.user,
            pendingUsers
        });
    } catch (error) {
        console.error("Error loading pending user approvals:", error);
        res.status(500).send("Error loading pending user approvals: " + error.message);
    }
});

app.post("/admin/user-approvals/:userId/approve", requireAdmin, async (req, res) => {
    const userId = Number(req.params.userId);
    const { confirmed_role } = req.body;
    const allowedRoles = ["doctor", "nurse", "patient", "visitor", "reception", "admin"];

    if (!Number.isSafeInteger(userId) || userId < 1
        || !allowedRoles.includes(confirmed_role)) {
        res.status(400).send("A valid user and role confirmation are required.");
        return;
    }

    try {
        const [result] = await dbConnection.promise().query(
            "UPDATE users SET is_approved = TRUE WHERE user_id = ? AND role = ? AND is_approved = FALSE",
            [userId, confirmed_role]
        );
        if (result.affectedRows !== 1) {
            res.status(409).send("The user's requested role did not match your confirmation, or the account is no longer pending.");
            return;
        }
        res.redirect("/admin/user-approvals");
    } catch (error) {
        console.error("Error approving user:", error);
        res.status(500).send("Error approving user: " + error.message);
    }
});
// Add a doctor and link the corresponding room and user records.
app.post("/add_doc", requireAdmin, (req, res) => {
    const { doctor_id, doc_name, speciality, phone_number, room_id, user_id } = req.body;
    const query = `
        INSERT INTO doctors (doctor_id, doc_name, speciality, phone_number, room_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?)`;
    dbConnection.query(query, [doctor_id, doc_name, speciality, phone_number, room_id, user_id], (err) => {
        if (err) {
            res.status(500).send("Error adding doctor: " + err.message);
        } else {
            res.redirect("/employees");
        }
    });
});
// Add a nurse and link the corresponding room and user records.
app.post("/add_nurse", requireAdmin, (req, res) => {
    const { nurse_id, nurse_name, speciality, phone_number, room_id, user_id } = req.body;
    const query = `
        INSERT INTO nurses (nurse_id, nurse_name, speciality, phone_number, room_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?)`;
    dbConnection.query(query, [nurse_id, nurse_name, speciality, phone_number, room_id, user_id], (err) => {
        if (err) {
            res.status(500).send("Error adding nurse: " + err.message);
        } else {
            res.redirect("/employees");
        }
    });
});
// Add a receptionist and return to the employee page.
app.post("/add_reception", requireAdmin, (req, res) => {
    const { recep_id, phone_no, user_id } = req.body;
    const query = "INSERT INTO receptionist (recep_id, phone_no, user_id) VALUES (?, ?, ?)";

    dbConnection.query(query, [recep_id, phone_no, user_id], (err) => {
        if (err) {
            res.status(500).send("Error adding receptionist: " + err.message);
        } else {
            res.redirect("/employees");
        }
    });
});

// Data display
// Display all doctors from the database.
app.get("/doctors",(req,res)=>{
dbConnection.query("SELECT doctor_id, doc_name, speciality, phone_number, room_id FROM doctors",(err,results) =>{
    if(err){
        res.status(500).send("ERROR FETCHING DATA");
    }else{
        res.render("doctors.ejs",{ doctors : results

        });
    }
});
});
// Display all drugs from the database.
app.get("/drugs",(req,res)=>{
    dbConnection.query("SELECT drug_id, drug_name, drug_type, stock_quantity, unit_price FROM drugs",(err,results)=>{
        if(err){
            res.status(500).send("Error cannot retrieve data");
        }else{
            res.render("drugs.ejs",{drugs : results});
        }
    });
});
// Display all patients with their assigned doctors.
//create a  get route for patients
app.get("/patients",(req,res)=>{
    const patientsQuery = `
        SELECT p.patient_id, p.patient_name, p.phone_no, p.doctor_id, d.doc_name
        FROM patients p
        LEFT JOIN doctors d ON p.doctor_id = d.doctor_id`;
    dbConnection.query(patientsQuery,(err,results)=>{
        if(err){
            res.status(500).send("Error cannot retrieve data");
        }else{
           // console.log(results)
            dbConnection.query("SELECT doctor_id, doc_name FROM doctors",(err,doctors)=>{
                if(err){
                    res.status(500).send("Error cannot retrieve doctors data");
                }else{
                    res.render("patients.ejs",{ patients : results, doctors : doctors });
                }
            });
        }
    });
});
// Display all nurses from the database.
// create a get route for nurses
app.get("/nurses",(req,res)=>{
dbConnection.query("SELECT nurse_id, nurse_name, speciality, phone_number, room_id FROM nurses",(err,results) =>{
    if(err){
        res.status(500).send("ERROR FETCHING DATA");
    }else{
        res.render("nurses.ejs",{ nurses : results});
    }
});
});
// Display all visitors from the database.
// create a get route for visitors
app.get("/visitors",(req,res)=>{
dbConnection.query(`
    SELECT v.visitor_id, v.visitor_name, v.phone_no, v.patient_id, p.patient_name
    FROM visitors v
    LEFT JOIN patients p ON p.patient_id = v.patient_id`,(err,results) =>{
    if(err){
        res.status(500).send("ERROR FETCHING DATA");
    }else{
        dbConnection.query("SELECT patient_id, patient_name FROM patients", (patientError, patients) => {
            if (patientError) {
                res.status(500).send("Error fetching patients: " + patientError.message);
            } else {
                res.render("visitors.ejs",{ visitors : results, patients });
            }
        });
    }
});
});

// Data creation
// Add a patient and return to the patients page.
// create a post route to add new doctors ,nurses and drugs to the database
app.post("/add-patients", requireAdminOrReception, (req, res) => {
    const { patient_id, patient_name, phone_no, date_of_birth, gender, address, doctor_id } = req.body;

    if (gender && !["male", "female", "other"].includes(gender)) {
        res.status(400).send("Choose a valid patient gender.");
        return;
    }

    const query = `
        INSERT INTO patients (patient_id, patient_name, phone_no, date_of_birth, gender, address, doctor_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;

    dbConnection.query(query, [
        patient_id,
        patient_name,
        phone_no,
        date_of_birth || null,
        gender || null,
        address || null,
        doctor_id
    ], (err) => {
        if (err) {
            res.status(500).send("Error adding patient: " + err.message);
        } else {
            res.redirect("/PatientsDir");
        }
    });
});

app.post("/patients/:patientId/status", requireAdminOrReception, (req, res) => {
    const { patientId } = req.params;
    const { patient_status } = req.body;

    if (!patientId || patientId.length > 30
        || !["in_house", "discharged"].includes(patient_status)) {
        res.status(400).send("Choose a valid patient status.");
        return;
    }

    dbConnection.query(
        "UPDATE patients SET patient_status = ? WHERE patient_id = ?",
        [patient_status, patientId],
        (error, result) => {
            if (error) {
                console.error("Error updating patient status:", error);
                res.status(500).send("Error updating patient status: " + error.message);
            } else if (result.affectedRows === 0) {
                res.status(404).send("Patient not found.");
            } else {
                res.redirect("/PatientsDir");
            }
        }
    );
});
// Add a visitor and return to the visitors page.
// create a post endpoint  to add new visitors to the database
app.post("/add-visitors",(req,res) =>{
    const { visitor_name, phone_no, patient_id } = req.body;
    const sqlQuery = "INSERT INTO visitors (visitor_name, phone_no, patient_id) VALUES (?, ?, ?)";
dbConnection.query(sqlQuery, [visitor_name, phone_no, patient_id], (err)=>{
    if(err){
        res.status(500).send("Error adding visitor: " + err.message) ;

    }else{
        res.redirect(req.body.returnTo === "directory" ? "/VisitorsDir" : "/visitors");
    }
});
});
// create a get route for the register page 
app.get("/register",(req,res)=>{
    res.render("register.ejs");
});
//create a post route to register new users
app.post("/register",  async (req, res) => {
    const { name, email, password, role } = req.body;
    const allowedRoles = ["doctor", "nurse", "patient", "admin", "visitor", "reception"];
    if (!name || !email || !password || !allowedRoles.includes(role)) {
        res.status(400).send("Name, email, password, and a valid role are required.");
        return;
    }
try {
    // Hash the password before storing it in the database
    const saltrounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltrounds);
    // add a new user to the database after hashing the password
    const query = "INSERT INTO users (name, email, password, role, is_approved) VALUES (?, ?, ?, ?, FALSE)";
    dbConnection.query(query, [name, email, hashedPassword, role], (err) => {
        if (err) {
            res.status(500).send("Error registering user: " + err.message);
        } else {
            res.redirect("/login");
        }
    });
} catch (err) {
    res.status(500).send("Error registering user: " + err.message);
}
});
// Display appointments alongside the patients and doctors available for booking.
app.get("/appointments", async (req, res) => {
    try {
        const [appointments] = await dbConnection.promise().query(`
            SELECT a.appointment_id, a.patient_id, a.doctor_id,
                   DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
                   TIME_FORMAT(a.appointment_time, '%H:%i') AS appointment_time,
                   a.status,
                   p.patient_name, d.doc_name
            FROM appointments a
            JOIN patients p ON p.patient_id = a.patient_id
            JOIN doctors d ON d.doctor_id = a.doctor_id
            ORDER BY a.appointment_date, a.appointment_time
        `);
        const [patients] = await dbConnection.promise().query(
            "SELECT patient_id, patient_name FROM patients ORDER BY patient_name"
        );
        const [doctors] = await dbConnection.promise().query(
            "SELECT doctor_id, doc_name, speciality FROM doctors ORDER BY doc_name"
        );

        res.render("Appointments.ejs", {
            appointments,
            patients,
            doctors,
            today: getLocalDateString()
        });
    } catch (error) {
        console.error("Error loading appointments:", error);
        res.status(500).send("Error loading appointments: " + error.message);
    }
});

// Create an appointment using the patient and doctor IDs from the form.
app.post("/add-appointments", (req, res) => {
    const { patient_id, doctor_id, appointment_date, appointment_time, reason } = req.body;
    const validDate = typeof appointment_date === "string"
        && /^\d{4}-\d{2}-\d{2}$/.test(appointment_date)
        && !Number.isNaN(Date.parse(appointment_date))
        && new Date(appointment_date).toISOString().slice(0, 10) === appointment_date;
    const validTime = typeof appointment_time === "string"
        && /^([01]\d|2[0-3]):[0-5]\d$/.test(appointment_time);

    if (typeof patient_id !== "string" || !patient_id.trim() || patient_id.length > 30
        || typeof doctor_id !== "string" || !doctor_id.trim() || doctor_id.length > 20
        || !validDate || appointment_date < getLocalDateString() || !validTime
        || (reason !== undefined && (typeof reason !== "string" || reason.length > 255))) {
        res.status(400).send("Choose a patient and doctor, and provide a valid appointment date that is today or later and a valid time.");
        return;
    }

    dbConnection.query(
        "INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, 'pending')",
        [patient_id.trim(), doctor_id.trim(), appointment_date, appointment_time, reason?.trim() || null],
        (err) => {
            if (err) {
                console.error("Error adding appointment:", err);
                res.status(500).send("Error adding appointment: " + err.message);
            } else {
                res.redirect("/appointments");
            }
        }
    );
});

app.post("/doctor/appointments/:appointmentId/accept", requireDoctor, async (req, res) => {
    const appointmentId = Number(req.params.appointmentId);
    if (!Number.isSafeInteger(appointmentId) || appointmentId < 1) {
        res.status(400).send("Invalid appointment ID.");
        return;
    }

    try {
        const [result] = await dbConnection.promise().query(`
            UPDATE appointments
            SET status = 'scheduled'
            WHERE appointment_id = ?
              AND doctor_id = (SELECT doctor_id FROM doctors WHERE user_id = ?)
              AND status = 'pending'
        `, [appointmentId, req.session.user.user_id]);
        if (result.affectedRows !== 1) {
            res.status(409).send("This pending appointment was not found for your account.");
            return;
        }
        res.redirect("/dashboard");
    } catch (error) {
        console.error("Error accepting appointment:", error);
        res.status(500).send("Error accepting appointment: " + error.message);
    }
});

app.post("/doctor/appointments/:appointmentId/cancel", requireDoctor, async (req, res) => {
    const appointmentId = Number(req.params.appointmentId);
    if (!Number.isSafeInteger(appointmentId) || appointmentId < 1) {
        res.status(400).send("Invalid appointment ID.");
        return;
    }

    try {
        const [result] = await dbConnection.promise().query(`
            UPDATE appointments
            SET status = 'cancelled'
            WHERE appointment_id = ?
              AND doctor_id = (SELECT doctor_id FROM doctors WHERE user_id = ?)
              AND status IN ('pending', 'scheduled')
        `, [appointmentId, req.session.user.user_id]);
        if (result.affectedRows !== 1) {
            res.status(409).send("This active appointment was not found for your account.");
            return;
        }
        res.redirect("/dashboard");
    } catch (error) {
        console.error("Error cancelling appointment:", error);
        res.status(500).send("Error cancelling appointment: " + error.message);
    }
});

app.post("/doctor/appointments/:appointmentId/reschedule", requireDoctor, async (req, res) => {
    const appointmentId = Number(req.params.appointmentId);
    const { appointment_date, appointment_time } = req.body;
    const validDate = typeof appointment_date === "string"
        && /^\d{4}-\d{2}-\d{2}$/.test(appointment_date)
        && !Number.isNaN(Date.parse(appointment_date))
        && new Date(appointment_date).toISOString().slice(0, 10) === appointment_date
        && appointment_date >= getLocalDateString();
    const validTime = typeof appointment_time === "string"
        && /^([01]\d|2[0-3]):[0-5]\d$/.test(appointment_time);

    if (!Number.isSafeInteger(appointmentId) || appointmentId < 1 || !validDate || !validTime) {
        res.status(400).send("Choose a valid appointment date (today or later) and time.");
        return;
    }

    try {
        const [result] = await dbConnection.promise().query(`
            UPDATE appointments
            SET appointment_date = ?, appointment_time = ?, status = 'pending'
            WHERE appointment_id = ?
              AND doctor_id = (SELECT doctor_id FROM doctors WHERE user_id = ?)
              AND status IN ('pending', 'scheduled')
        `, [appointment_date, appointment_time, appointmentId, req.session.user.user_id]);
        if (result.affectedRows !== 1) {
            res.status(409).send("This active appointment was not found for your account.");
            return;
        }
        res.redirect("/dashboard");
    } catch (error) {
        console.error("Error rescheduling appointment:", error);
        res.status(500).send("Error rescheduling appointment: " + error.message);
    }
});
// create a route for the patient directory page
app.get("/PatientsDir", requireAdminOrReception, (req,res)=>{
    const patientsQuery = `
        SELECT p.patient_id, p.patient_name, p.phone_no, p.doctor_id,
               p.patient_status, d.doc_name
        FROM patients p
        LEFT JOIN doctors d ON p.doctor_id = d.doctor_id`;
    dbConnection.query(patientsQuery,(err,results)=>{
        if(err){
            res.status(500).send("Error cannot retrieve data");
        }else{
           // console.log(results)
            dbConnection.query("SELECT doctor_id, doc_name FROM doctors",(err,doctors)=>{
                if(err){
                    res.status(500).send("Error cannot retrieve doctors data");
                }else{
                    res.render("PatientsDir.ejs", {
                        user: req.session.user,
                        patients: results,
                        doctors
                    });
                }
            });
        }
    });
});
// create a route for the visitor directory page
app.get("/VisitorsDir", requireAdminOrReception, (req,res)=>{
dbConnection.query(`
    SELECT v.visitor_id, v.visitor_name, v.phone_no, v.patient_id, p.patient_name
    FROM visitors v
    LEFT JOIN patients p ON p.patient_id = v.patient_id`,(err,results) =>{
    if(err){
        res.status(500).send("ERROR FETCHING DATA");
    }else{
        dbConnection.query("SELECT patient_id, patient_name FROM patients", (patientError, patients) => {
            if (patientError) {
                res.status(500).send("Error fetching patients: " + patientError.message);
            } else {
                res.render("VisitorsDir.ejs", {
                    user: req.session.user,
                    visitors: results,
                    patients
                });
            }
        });
    }
});
});

    // create an error 404 endpoint
    app.use((req,res)=>{
        res.status(404).render("404.ejs");
    });


// create a listening port
app.listen(port,()=>{
    console.log(`server is running on http://localhost:${port}`);
});