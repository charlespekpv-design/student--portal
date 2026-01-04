const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-this-in-production';

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://charlespekpv_db_user:lNxA7NOjAtgCKD6O@charlesdb.bwwmo4v.mongodb.net/studentPortal?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Student Schema
const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  studentId: { type: String, required: true, unique: true },
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  createdAt: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', studentSchema);

// Course Schema
const courseSchema = new mongoose.Schema({
  courseCode: { type: String, required: true, unique: true },
  courseName: { type: String, required: true },
  instructor: { type: String, required: true },
  credits: { type: Number, required: true },
  description: { type: String },
  capacity: { type: Number, default: 30 },
  enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  createdAt: { type: Date, default: Date.now }
});

const Course = mongoose.model('Course', courseSchema);

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
    const existingStudent = await Student.findOne({ $or: [{ email }, { studentId }] });
    if (existingStudent) {
      return res.status(400).json({ error: 'Student already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create student
    const student = new Student({
      name,
      email,
      password: hashedPassword,
      studentId
    });

    await student.save();

    // Generate token
    const token = jwt.sign({ id: student._id }, JWT_SECRET, { expiresIn: '7d' });

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
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, student.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: student._id }, JWT_SECRET, { expiresIn: '7d' });

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
    const student = await Student.findById(req.studentId)
      .select('-password')
      .populate('enrolledCourses');
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Student Profile
app.put('/api/students/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    const student = await Student.findByIdAndUpdate(
      req.studentId,
      { name, email },
      { new: true }
    ).select('-password');
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Students
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().select('-password');
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

    const course = new Course({
      courseCode,
      courseName,
      instructor,
      credits,
      description,
      capacity
    });

    await course.save();
    res.status(201).json({ message: 'Course created successfully', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Courses
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await Course.find().populate('enrolledStudents', 'name email studentId');
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Single Course
app.get('/api/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('enrolledStudents', 'name email studentId');
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
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
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { courseCode, courseName, instructor, credits, description, capacity },
      { new: true }
    );
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course updated successfully', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Course
app.delete('/api/courses/:id', async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Remove course from all enrolled students
    await Student.updateMany(
      { enrolledCourses: course._id },
      { $pull: { enrolledCourses: course._id } }
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
    const course = await Course.findById(req.params.id);
    const student = await Student.findById(req.studentId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if already enrolled
    if (student.enrolledCourses.includes(course._id)) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // Check capacity
    if (course.enrolledStudents.length >= course.capacity) {
      return res.status(400).json({ error: 'Course is full' });
    }

    // Enroll student
    course.enrolledStudents.push(student._id);
    student.enrolledCourses.push(course._id);

    await course.save();
    await student.save();

    res.json({ message: 'Enrolled successfully', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Drop Course
app.post('/api/courses/:id/drop', authMiddleware, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    const student = await Student.findById(req.studentId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Remove student from course
    course.enrolledStudents = course.enrolledStudents.filter(
      id => id.toString() !== student._id.toString()
    );
    student.enrolledCourses = student.enrolledCourses.filter(
      id => id.toString() !== course._id.toString()
    );

    await course.save();
    await student.save();

    res.json({ message: 'Dropped course successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Student's Enrolled Courses
app.get('/api/students/courses/enrolled', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.studentId).populate('enrolledCourses');
    res.json(student.enrolledCourses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Root route
app.get('/', (req, res) => {
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

// Serve static files
app.use(express.static('.'));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});