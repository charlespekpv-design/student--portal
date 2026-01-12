const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coursesDB';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ============================================
// SCHEMAS
// ============================================

// User Schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: String,
  role: {
    type: String,
    enum: ['student', 'instructor', 'admin'],
    default: 'student'
  }
}, {
  timestamps: true
});

// Course Schema
const courseSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  courseName: {
    type: String,
    required: true
  },
  credits: {
    type: Number,
    default: 3
  },
  department: String,
  instructor: String,
  description: String
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);
const Course = mongoose.model('Course', courseSchema);

// ============================================
// AUTH MIDDLEWARE
// ============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Course API Server with Authentication',
    endpoints: {
      auth: {
        'POST /api/register': 'Register new user',
        'POST /api/login': 'Login user',
        'GET /api/me': 'Get current user (requires token)'
      },
      courses: {
        'GET /api/courses': 'Get all courses',
        'GET /api/courses/:id': 'Get course by ID',
        'GET /api/courses/code/:courseCode': 'Get course by course code',
        'POST /api/courses': 'Create a new course',
        'PUT /api/courses/:id': 'Update course by ID',
        'PUT /api/courses/code/:courseCode': 'Update course by course code',
        'DELETE /api/courses/:id': 'Delete course by ID',
        'DELETE /api/courses/code/:courseCode': 'Delete course by course code'
      }
    }
  });
});

// ============================================
// AUTH ROUTES
// ============================================

// Register new user
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: role || 'student'
    });

    await newUser.save();

    // Generate token
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error during registration',
      message: error.message
    });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error during login',
      message: error.message
    });
  }
});

// Get current user (protected route)
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
});

// ============================================
// COURSE ROUTES
// ============================================

// Get all courses
app.get('/api/courses', async (req, res) => {
  try {
    const { courseCode, department, instructor } = req.query;
    const filter = {};
    
    if (courseCode) filter.courseCode = courseCode.toUpperCase();
    if (department) filter.department = department;
    if (instructor) filter.instructor = instructor;
    
    const courses = await Course.find(filter);
    res.json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error while fetching courses',
      message: error.message
    });
  }
});

// Get course by MongoDB ObjectId
app.get('/api/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }
    
    const course = await Course.findById(id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }
    
    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error while fetching course',
      message: error.message
    });
  }
});

// Get course by course code
app.get('/api/courses/code/:courseCode', async (req, res) => {
  try {
    const { courseCode } = req.params;
    const course = await Course.findOne({ courseCode: courseCode.toUpperCase() });
    
    if (!course) {
      return res.status(404).json({
        success: false,
        error: `Course with code ${courseCode} not found`
      });
    }
    
    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error while fetching course',
      message: error.message
    });
  }
});

// Create a new course
app.post('/api/courses', async (req, res) => {
  try {
    const { courseCode, courseName, credits, department, instructor, description } = req.body;
    
    if (!courseCode || !courseName) {
      return res.status(400).json({
        success: false,
        error: 'courseCode and courseName are required'
      });
    }
    
    const existingCourse = await Course.findOne({ courseCode: courseCode.toUpperCase() });
    if (existingCourse) {
      return res.status(409).json({
        success: false,
        error: `Course with code ${courseCode} already exists`
      });
    }
    
    const newCourse = new Course({
      courseCode: courseCode.toUpperCase(),
      courseName,
      credits: credits || 3,
      department,
      instructor,
      description
    });
    
    const savedCourse = await newCourse.save();
    
    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: savedCourse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error while creating course',
      message: error.message
    });
  }
});

// Update course by MongoDB ObjectId
app.put('/api/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }
    
    const { courseCode, ...updateData } = req.body;
    
    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Course updated successfully',
      data: updatedCourse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error while updating course',
      message: error.message
    });
  }
});

// Update course by course code
app.put('/api/courses/code/:courseCode', async (req, res) => {
  try {
    const { courseCode } = req.params;
    const { courseCode: newCode, ...updateData } = req.body;
    
    const updatedCourse = await Course.findOneAndUpdate(
      { courseCode: courseCode.toUpperCase() },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({
        success: false,
        error: `Course with code ${courseCode} not found`
      });
    }
    
    res.json({
      success: true,
      message: 'Course updated successfully',
      data: updatedCourse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error while updating course',
      message: error.message
    });
  }
});

// Delete course by MongoDB ObjectId
app.delete('/api/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }
    
    const deletedCourse = await Course.findByIdAndDelete(id);
    
    if (!deletedCourse) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Course deleted successfully',
      data: deletedCourse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error while deleting course',
      message: error.message
    });
  }
});

// Delete course by course code
app.delete('/api/courses/code/:courseCode', async (req, res) => {
  try {
    const { courseCode } = req.params;
    
    const deletedCourse = await Course.findOneAndDelete({ 
      courseCode: courseCode.toUpperCase() 
    });
    
    if (!deletedCourse) {
      return res.status(404).json({
        success: false,
        error: `Course with code ${courseCode} not found`
      });
    }
    
    res.json({
      success: true,
      message: 'Course deleted successfully',
      data: deletedCourse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error while deleting course',
      message: error.message
    });
  }
});

// ============================================
// ERROR HANDLERS
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/`);
});

module.exports = app;