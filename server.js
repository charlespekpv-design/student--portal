const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-this-in-production';

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://charlespekpv_db_user:lNxA7NOjAtgCKD6O@charlesdb.bwwmo4v.mongodb.net/?retryWrites=true&w=majority';
const DB_NAME = 'studentPortal';

let db;
let studentsCollection;
let coursesCollection;

// Connect to MongoDB
MongoClient.connect(MONGODB_URI)
  .then(client => {
    console.log('✅ Connected to MongoDB - Student Portal');
    db = client.db(DB_NAME);
    studentsCollection = db.collection('students');
    coursesCollection = db.collection('courses');
    
    // Create indexes for better performance
    studentsCollection.createIndex({ email: 1 }, { unique: true });
    studentsCollection.createIndex({ studentId: 1 }, { unique: true });
    coursesCollection.createIndex({ courseCode: 1 }, { unique: true });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Auth Middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.studentId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ===== STUDENT ROUTES =====

// Student Registration
app.post('/api/students/register', async (req, res) => {
  try {
    const { name, email, password, studentId } = req.body;

    // Check if student exists
    const existingStudent = await studentsCollection.findOne({
      $or: [{ email }, { studentId }]
    });
    
    if (existingStudent) {
      return res.status(400).json({ error: 'Student already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create student
    const student = {
      name,
      email,
      password: hashedPassword,
      studentId,
      enrolledCourses: [],
      createdAt: new Date()
    };

    const result = await studentsCollection.insertOne(student);
    student._id = result.insertedId;

    // Generate token
    const token = jwt.sign({ id: student._id.toString() }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Student registered successfully',
      token,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        studentId: student.studentId
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Login
app.post('/api/students/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find student
    const student = await studentsCollection.findOne({ email });
    if (!student) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, student.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: student._id.toString() }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        studentId: student.studentId
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Student Profile
app.get('/api/students/profile', authMiddleware, async (req, res) => {
  try {
    const student = await studentsCollection.findOne(
      { _id: new ObjectId(req.studentId) },
      { projection: { password: 0 } }
    );
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get enrolled courses details
    if (student.enrolledCourses && student.enrolledCourses.length > 0) {
      const courseIds = student.enrolledCourses.map(id => new ObjectId(id));
      student.enrolledCourses = await coursesCollection.find({
        _id: { $in: courseIds }
      }).toArray();
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Student Profile
app.put('/api/students/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    const result = await studentsCollection.findOneAndUpdate(
      { _id: new ObjectId(req.studentId) },
      { $set: { name, email } },
      { returnDocument: 'after', projection: { password: 0 } }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(result.value);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Students
app.get('/api/students', async (req, res) => {
  try {
    const students = await studentsCollection.find(
      {},
      { projection: { password: 0 } }
    ).toArray();
    
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== COURSE ROUTES =====

// Create Course
app.post('/api/courses', async (req, res) => {
  try {
    const { courseCode, courseName, instructor, credits, description, capacity } = req.body;

    const course = {
      courseCode,
      courseName,
      instructor,
      credits,
      description,
      capacity: capacity || 30,
      enrolledStudents: [],
      createdAt: new Date()
    };

    const result = await coursesCollection.insertOne(course);
    course._id = result.insertedId;

    res.status(201).json({ message: 'Course created successfully', course });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Course code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Get All Courses
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await coursesCollection.find({}).toArray();
    
    // Populate enrolled students
    for (let course of courses) {
      if (course.enrolledStudents && course.enrolledStudents.length > 0) {
        const studentIds = course.enrolledStudents.map(id => new ObjectId(id));
        course.enrolledStudents = await studentsCollection.find(
          { _id: { $in: studentIds } },
          { projection: { name: 1, email: 1, studentId: 1 } }
        ).toArray();
      }
    }

    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Single Course
app.get('/api/courses/:id', async (req, res) => {
  try {
    const course = await coursesCollection.findOne({ _id: new ObjectId(req.params.id) });
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Populate enrolled students
    if (course.enrolledStudents && course.enrolledStudents.length > 0) {
      const studentIds = course.enrolledStudents.map(id => new ObjectId(id));
      course.enrolledStudents = await studentsCollection.find(
        { _id: { $in: studentIds } },
        { projection: { name: 1, email: 1, studentId: 1 } }
      ).toArray();
    }

    res.json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Course
app.put('/api/courses/:id', async (req, res) => {
  try {
    const { courseCode, courseName, instructor, credits, description, capacity } = req.body;
    
    const result = await coursesCollection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { 
        $set: { 
          courseCode, 
          courseName, 
          instructor, 
          credits, 
          description, 
          capacity 
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ message: 'Course updated successfully', course: result.value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Course
app.delete('/api/courses/:id', async (req, res) => {
  try {
    const courseId = new ObjectId(req.params.id);
    
    const result = await coursesCollection.findOneAndDelete({ _id: courseId });
    
    if (!result.value) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Remove course from all enrolled students
    await studentsCollection.updateMany(
      { enrolledCourses: req.params.id },
      { $pull: { enrolledCourses: req.params.id } }
    );

    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ENROLLMENT ROUTES =====

// Enroll in Course
app.post('/api/courses/:id/enroll', authMiddleware, async (req, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.studentId;

    const course = await coursesCollection.findOne({ _id: new ObjectId(courseId) });
    const student = await studentsCollection.findOne({ _id: new ObjectId(studentId) });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check if already enrolled
    if (student.enrolledCourses && student.enrolledCourses.includes(courseId)) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // Check capacity
    const enrolledCount = course.enrolledStudents ? course.enrolledStudents.length : 0;
    if (enrolledCount >= course.capacity) {
      return res.status(400).json({ error: 'Course is full' });
    }

    // Enroll student
    await coursesCollection.updateOne(
      { _id: new ObjectId(courseId) },
      { $push: { enrolledStudents: studentId } }
    );

    await studentsCollection.updateOne(
      { _id: new ObjectId(studentId) },
      { $push: { enrolledCourses: courseId } }
    );

    res.json({ message: 'Enrolled successfully', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Drop Course
app.post('/api/courses/:id/drop', authMiddleware, async (req, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.studentId;

    const course = await coursesCollection.findOne({ _id: new ObjectId(courseId) });
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Remove student from course
    await coursesCollection.updateOne(
      { _id: new ObjectId(courseId) },
      { $pull: { enrolledStudents: studentId } }
    );

    await studentsCollection.updateOne(
      { _id: new ObjectId(studentId) },
      { $pull: { enrolledCourses: courseId } }
    );

    res.json({ message: 'Dropped course successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Student's Enrolled Courses
app.get('/api/students/courses/enrolled', authMiddleware, async (req, res) => {
  try {
    const student = await studentsCollection.findOne({ _id: new ObjectId(req.studentId) });
    
    if (!student || !student.enrolledCourses || student.enrolledCourses.length === 0) {
      return res.json([]);
    }

    const courseIds = student.enrolledCourses.map(id => new ObjectId(id));
    const courses = await coursesCollection.find({ _id: { $in: courseIds } }).toArray();
    
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/api', (req, res) => {
  res.json({
    message: 'Student Portal API',
    endpoints: {
      students: {
        register: 'POST /api/students/register',
        login: 'POST /api/students/login',
        profile: 'GET /api/students/profile (auth)',
        updateProfile: 'PUT /api/students/profile (auth)',
        getAll: 'GET /api/students'
      },
      courses: {
        create: 'POST /api/courses',
        getAll: 'GET /api/courses',
        getOne: 'GET /api/courses/:id',
        update: 'PUT /api/courses/:id',
        delete: 'DELETE /api/courses/:id',
        enroll: 'POST /api/courses/:id/enroll (auth)',
        drop: 'POST /api/courses/:id/drop (auth)',
        enrolled: 'GET /api/students/courses/enrolled (auth)'
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 Visit http://localhost:${PORT} to access the Student Portal`);
});