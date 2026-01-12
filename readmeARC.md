{
  "message": "Course deleted successfully"
}
```

---

## 📊 Complete ARC Workflow Examples

### **Example 1: Modify Course Instructor**
```
Method: PUT
URL: https://nc7g6nck-3000.asse.devtunnels.ms/api/courses/6959cdf1ceff151845b1e44d

Headers:
  Content-Type: application/json

Body:
{
  "courseCode": "MATH201",
  "courseName": "Calculus II",
  "instructor": "Prof. Williams",
  "credits": 4,
  "description": "Advanced calculus",
  "capacity": 25
}
```

---

### **Example 2: Modify Course Capacity**
```
Method: PUT
URL: https://nc7g6nck-3000.asse.devtunnels.ms/api/courses/6959cdf1ceff151845b1e44d

Headers:
  Content-Type: application/json

Body:
{
  "courseCode": "CS101",
  "courseName": "Introduction to Computer Science",
  "instructor": "Dr. Smith",
  "credits": 3,
  "description": "Learn programming fundamentals",
  "capacity": 50
}
```

---

### **Example 3: Delete Multiple Courses**
```
1. DELETE /api/courses/6959cdf1ceff151845b1e44d
   → Response: "Course deleted successfully"

2. DELETE /api/courses/6959abc123def456789012ab
   → Response: "Course deleted successfully"

3. GET /api/courses
   → Verify courses are gone
```

---

## 🎯 Visual ARC Interface for UPDATE:
```
┌─────────────────────────────────────────────────────┐
│ PUT ▼  https://nc7g6nck-3000.asse.devtunnels.ms... │
├─────────────────────────────────────────────────────┤
│ HEADERS | BODY | AUTHORIZATION | ACTIONS             │
├─────────────────────────────────────────────────────┤
│ HEADERS TAB:                                         │
│ + ADD                                                │
│ Content-Type: application/json                       │
├─────────────────────────────────────────────────────┤
│ BODY TAB:                                           │
│ ☑ Text editor                                       │
│                                                      │
│ {                                                    │
│   "courseCode": "CS101",                            │
│   "courseName": "UPDATED NAME",                     │
│   "instructor": "NEW INSTRUCTOR",                   │
│   "credits": 4,                                     │
│   "description": "UPDATED DESCRIPTION",             │
│   "capacity": 40                                    │
│ }                                                    │
│                                                      │
│                                    [SEND ▶]         │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Visual ARC Interface for DELETE:
```
┌─────────────────────────────────────────────────────┐
│ DELETE ▼  https://nc7g6nck-3000.asse.devtunnels... │
├─────────────────────────────────────────────────────┤
│ HEADERS | AUTHORIZATION | ACTIONS | CONFIG          │
├─────────────────────────────────────────────────────┤
│ HEADERS TAB:                                         │
│ + ADD                                                │
│ Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cC... │
├─────────────────────────────────────────────────────┤
│ NO BODY NEEDED FOR DELETE                           │
│                                                      │
│                                    [SEND ▶]         │
└─────────────────────────────────────────────────────┘
```

---

## 🧪 Complete Testing Scenarios:

### **Scenario 1: Update and Verify**
```
1. GET /api/courses/6959cdf1ceff151845b1e44d
   → Note current values

2. PUT /api/courses/6959cdf1ceff151845b1e44d
   → Update with new values

3. GET /api/courses/6959cdf1ceff151845b1e44d
   → Verify changes were saved
```

---

### **Scenario 2: Delete and Verify**
```
1. GET /api/courses
   → Count: 6 courses

2. DELETE /api/courses/6959cdf1ceff151845b1e44d
   → Response: "Course deleted successfully"

3. GET /api/courses
   → Count: 5 courses (one less!)

4. GET /api/courses/6959cdf1ceff151845b1e44d
   → Response: "Course not found" (404)
```

---

### **Scenario 3: Update Then Delete**
```
1. PUT /api/courses/ABC123 (update course)
2. GET /api/courses/ABC123 (verify update)
3. DELETE /api/courses/ABC123 (delete it)
4. GET /api/courses/ABC123 (verify deletion - should get 404)