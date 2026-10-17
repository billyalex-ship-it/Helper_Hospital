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

            const [doctorResult, nurseResult, patientResult, visitorResult] = await Promise.all([
                dbConnection.promise().query(doctorQuery),
                dbConnection.promise().query(nurseQuery),
                dbConnection.promise().query(patientQuery),
                dbConnection.promise().query(visitorQuery)
            ]);

            res.render("admindash.ejs", {
                user: req.session.user,
                doctorresult: doctorResult[0][0],
                nurseResult: nurseResult[0][0],
                patientResult: patientResult[0][0],
                visitorResult: visitorResult[0][0]
            });
            return;
        } else if(req.session.user.role == "doctor"){
            res.render("doctordash.ejs", { user: req.session.user });
        }else if(req.session.user.role == "nurse"){
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
    const userquery = "SELECT user_id, name, email, role FROM users";
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
            user.role === "doctor" && !docResults[0].some(doctor => doctor.user_id === user.user_id)
        ),
        nurseUsers: userResults[0].filter(user =>
            user.role === "nurse" && !nurseResults[0].some(nurse => nurse.user_id === user.user_id)
        ),
        receptionUsers: userResults[0].filter(user =>
            user.role === "reception" && !receptionResults[0].some(recep => recep.user_id === user.user_id)
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
app.post("/add-patients", requireAdmin, (req, res) => {
    const { patient_id, patient_name, phone_no, date_of_birth, gender, address, doctor_id } = req.body;

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
            res.redirect("/patients");
        }
    });
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
        res.redirect("/visitors");
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
    const query = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";
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
    
          

    // create an error 404 endpoint
    app.use((req,res)=>{
        res.status(404).render("404.ejs");
    });


// create a listening port
app.listen(port,()=>{
    console.log(`server is running on http://localhost:${port}`);
});