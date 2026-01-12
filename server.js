const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coursesDB';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Course Schema
const courseSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
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

const Course = mongoose.model('Course', courseSchema);

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Course API Server is running',
    endpoints: {
      'GET /api/courses': 'Get all courses',
      'GET /api/courses/:id': 'Get course by ID',
      'GET /api/courses/code/:courseCode': 'Get course by course code',
      'POST /api/courses': 'Create a new course',
      'PUT /api/courses/:id': 'Update course by ID',
      'PUT /api/courses/code/:courseCode': 'Update course by course code',
      'DELETE /api/courses/:id': 'Delete course by ID',
      'DELETE /api/courses/code/:courseCode': 'Delete course by course code'
    }
  });
});

// ============================================
// GET ROUTES
// ============================================

// Get all courses (with optional query filtering)
app.get('/api/courses', async (req, res) => {
  try {
    const { courseCode, department, instructor } = req.query;
    const filter = {};
    
    if (courseCode) filter.courseCode = courseCode;
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
    
    // Validate ObjectId format
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

// ============================================
// POST ROUTE
// ============================================

// Create a new course
app.post('/api/courses', async (req, res) => {
  try {
    const { courseCode, courseName, credits, department, instructor, description } = req.body;
    
    // Validation
    if (!courseCode || !courseName) {
      return res.status(400).json({
        success: false,
        error: 'courseCode and courseName are required'
      });
    }
    
    // Check if course code already exists
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
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        error: 'Course code already exists'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Server error while creating course',
        message: error.message
      });
    }
  }
});

// ============================================
// PUT ROUTES
// ============================================

// Update course by MongoDB ObjectId
app.put('/api/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }
    
    // Don't allow changing courseCode through update
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
    
    // Don't allow changing courseCode through update
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

// ============================================
// DELETE ROUTES
// ============================================

// Delete course by MongoDB ObjectId
app.delete('/api/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
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
// 404 Handler
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// ============================================
// Error Handler
// ============================================
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