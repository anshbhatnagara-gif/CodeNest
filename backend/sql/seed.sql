-- CodeNest Free Academy — Seed Data (v1.0)
-- Run AFTER schema.sql
USE codenest_free_academy;

-- =============================================
-- COURSES (10 Free Courses — Idempotent Seeding)
-- =============================================
INSERT INTO courses (title, description, category, difficulty, duration, thumbnail, instructor)
SELECT
  'HTML Basics',
  'Learn the foundation of the web! Master HTML5 tags, semantic elements, forms, tables, and page structure. Build your first webpage from scratch.',
  'Web Development',
  'Beginner',
  '4 hours',
  'https://images.unsplash.com/photo-1621839673705-6617adf9e890?auto=format&fit=crop&w=600&q=80',
  'Ansh Bhatnagar'
WHERE NOT EXISTS (
  SELECT 1 FROM courses WHERE title = 'HTML Basics'
);

INSERT INTO courses (title, description, category, difficulty, duration, thumbnail, instructor)
SELECT
  'CSS Basics',
  'Style your websites beautifully! Learn CSS selectors, box model, Flexbox, Grid, animations, and responsive design for all screen sizes.',
  'Web Development',
  'Beginner',
  '5 hours',
  'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80',
  'Ansh Bhatnagar'
WHERE NOT EXISTS (
  SELECT 1 FROM courses WHERE title = 'CSS Basics'
);

INSERT INTO courses (title, description, category, difficulty, duration, thumbnail, instructor)
SELECT
  'JavaScript Basics',
  'Make your websites interactive! Learn variables, functions, DOM manipulation, events, arrays, objects, and modern ES6+ JavaScript syntax.',
  'Web Development',
  'Beginner',
  '8 hours',
  'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?auto=format&fit=crop&w=600&q=80',
  'Ansh Bhatnagar'
WHERE NOT EXISTS (
  SELECT 1 FROM courses WHERE title = 'JavaScript Basics'
);

INSERT INTO courses (title, description, category, difficulty, duration, thumbnail, instructor)
SELECT
  'React Basics',
  'Build modern single-page applications! Learn React components, hooks, state management, props, React Router, and useEffect in detail.',
  'Frontend',
  'Intermediate',
  '10 hours',
  'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=600&q=80',
  'Ansh Bhatnagar'
WHERE NOT EXISTS (
  SELECT 1 FROM courses WHERE title = 'React Basics'
);

INSERT INTO courses (title, description, category, difficulty, duration, thumbnail, instructor)
SELECT
  'Node.js Basics',
  'Build powerful backend applications with JavaScript! Learn Node.js modules, Express.js, REST APIs, middleware, and file system operations.',
  'Backend',
  'Intermediate',
  '8 hours',
  'https://images.unsplash.com/photo-1566837945700-30057527ade0?auto=format&fit=crop&w=600&q=80',
  'Ansh Bhatnagar'
WHERE NOT EXISTS (
  SELECT 1 FROM courses WHERE title = 'Node.js Basics'
);

INSERT INTO courses (title, description, category, difficulty, duration, thumbnail, instructor)
SELECT
  'MySQL Basics',
  'Master relational databases! Learn SQL queries, database design, joins, indexes, stored procedures, and how to connect MySQL with Node.js.',
  'Database',
  'Beginner',
  '6 hours',
  'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&w=600&q=80',
  'Ansh Bhatnagar'
WHERE NOT EXISTS (
  SELECT 1 FROM courses WHERE title = 'MySQL Basics'
);

INSERT INTO courses (title, description, category, difficulty, duration, thumbnail, instructor)
SELECT
  'Git & GitHub',
  'Master version control! Learn Git commands, branching strategies, merge conflicts, pull requests, GitHub workflows, and collaborative coding.',
  'Tools',
  'Beginner',
  '3 hours',
  'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?auto=format&fit=crop&w=600&q=80',
  'Ansh Bhatnagar'
WHERE NOT EXISTS (
  SELECT 1 FROM courses WHERE title = 'Git & GitHub'
);

INSERT INTO courses (title, description, category, difficulty, duration, thumbnail, instructor)
SELECT
  'C Programming Basics',
  'Learn the mother of all programming languages! Master variables, data types, pointers, arrays, functions, structs, and memory management in C.',
  'Programming',
  'Beginner',
  '7 hours',
  'https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?auto=format&fit=crop&w=600&q=80',
  'Ansh Bhatnagar'
WHERE NOT EXISTS (
  SELECT 1 FROM courses WHERE title = 'C Programming Basics'
);

INSERT INTO courses (title, description, category, difficulty, duration, thumbnail, instructor)
SELECT
  'Python Basics',
  'Start your programming journey with Python! Learn syntax, data structures, functions, file handling, OOP concepts, and popular Python libraries.',
  'Programming',
  'Beginner',
  '7 hours',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
  'Ansh Bhatnagar'
WHERE NOT EXISTS (
  SELECT 1 FROM courses WHERE title = 'Python Basics'
);

INSERT INTO courses (title, description, category, difficulty, duration, thumbnail, instructor)
SELECT
  'DSA Basics',
  'Crack coding interviews! Learn arrays, linked lists, stacks, queues, trees, graphs, sorting algorithms, and dynamic programming with real examples.',
  'Computer Science',
  'Intermediate',
  '12 hours',
  'https://images.unsplash.com/photo-1516116216624-53e697fedbea?auto=format&fit=crop&w=600&q=80',

  'Ansh Bhatnagar'
WHERE NOT EXISTS (
  SELECT 1 FROM courses WHERE title = 'DSA Basics'
);

-- =============================================
-- MODULES for HTML Basics
-- =============================================
INSERT INTO modules (course_id, title, order_index, duration)
SELECT c.id, v.title, v.order_index, v.duration
FROM courses c
CROSS JOIN (
  SELECT 'Introduction to HTML & Web Basics' AS title, 1 AS order_index, '20 min' AS duration UNION ALL
  SELECT 'HTML Tags & Elements' AS title, 2 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'Headings, Paragraphs & Text Formatting' AS title, 3 AS order_index, '20 min' AS duration UNION ALL
  SELECT 'Links, Images & Media' AS title, 4 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'HTML Forms & Input Fields' AS title, 5 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Tables & Lists' AS title, 6 AS order_index, '20 min' AS duration UNION ALL
  SELECT 'Semantic HTML5 Elements' AS title, 7 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'Building Your First Complete Webpage' AS title, 8 AS order_index, '35 min' AS duration
) AS v
WHERE c.title = 'HTML Basics'
  AND NOT EXISTS (
    SELECT 1 FROM modules m
    WHERE m.course_id = c.id AND m.order_index = v.order_index
  );

-- MODULES for CSS Basics
INSERT INTO modules (course_id, title, order_index, duration)
SELECT c.id, v.title, v.order_index, v.duration
FROM courses c
CROSS JOIN (
  SELECT 'Introduction to CSS & Selectors' AS title, 1 AS order_index, '20 min' AS duration UNION ALL
  SELECT 'Colors, Fonts & Text Styling' AS title, 2 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'Box Model: Margin, Padding, Border' AS title, 3 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'CSS Flexbox Layout' AS title, 4 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'CSS Grid System' AS title, 5 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'Responsive Design & Media Queries' AS title, 6 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'CSS Animations & Transitions' AS title, 7 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'Building a Responsive Landing Page' AS title, 8 AS order_index, '40 min' AS duration
) AS v
WHERE c.title = 'CSS Basics'
  AND NOT EXISTS (
    SELECT 1 FROM modules m
    WHERE m.course_id = c.id AND m.order_index = v.order_index
  );

-- MODULES for JavaScript Basics
INSERT INTO modules (course_id, title, order_index, duration)
SELECT c.id, v.title, v.order_index, v.duration
FROM courses c
CROSS JOIN (
  SELECT 'Introduction to JavaScript' AS title, 1 AS order_index, '20 min' AS duration UNION ALL
  SELECT 'Variables, Data Types & Operators' AS title, 2 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'Functions & Scope' AS title, 3 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Arrays & Array Methods' AS title, 4 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Objects & JSON' AS title, 5 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'DOM Manipulation' AS title, 6 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'Events & Event Listeners' AS title, 7 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Async JavaScript, Promises & Fetch API' AS title, 8 AS order_index, '40 min' AS duration UNION ALL
  SELECT 'ES6+ Modern JavaScript Features' AS title, 9 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'Building an Interactive Web App' AS title, 10 AS order_index, '45 min' AS duration
) AS v
WHERE c.title = 'JavaScript Basics'
  AND NOT EXISTS (
    SELECT 1 FROM modules m
    WHERE m.course_id = c.id AND m.order_index = v.order_index
  );

-- MODULES for React Basics
INSERT INTO modules (course_id, title, order_index, duration)
SELECT c.id, v.title, v.order_index, v.duration
FROM courses c
CROSS JOIN (
  SELECT 'Introduction to React & Vite Setup' AS title, 1 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'JSX & Component Basics' AS title, 2 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Props & Component Communication' AS title, 3 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'useState Hook & State Management' AS title, 4 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'useEffect Hook & Lifecycle' AS title, 5 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'React Router & Navigation' AS title, 6 AS order_index, '40 min' AS duration UNION ALL
  SELECT 'Fetching Data from APIs in React' AS title, 7 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'Building a Full React Application' AS title, 8 AS order_index, '50 min' AS duration
) AS v
WHERE c.title = 'React Basics'
  AND NOT EXISTS (
    SELECT 1 FROM modules m
    WHERE m.course_id = c.id AND m.order_index = v.order_index
  );

-- MODULES for Node.js Basics
INSERT INTO modules (course_id, title, order_index, duration)
SELECT c.id, v.title, v.order_index, v.duration
FROM courses c
CROSS JOIN (
  SELECT 'Introduction to Node.js & npm' AS title, 1 AS order_index, '20 min' AS duration UNION ALL
  SELECT 'Modules & CommonJS' AS title, 2 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'File System & Streams' AS title, 3 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Introduction to Express.js' AS title, 4 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'REST API Design & Routes' AS title, 5 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'Middleware & Error Handling' AS title, 6 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'JWT Authentication in Express' AS title, 7 AS order_index, '40 min' AS duration UNION ALL
  SELECT 'Building a REST API from Scratch' AS title, 8 AS order_index, '45 min' AS duration
) AS v
WHERE c.title = 'Node.js Basics'
  AND NOT EXISTS (
    SELECT 1 FROM modules m
    WHERE m.course_id = c.id AND m.order_index = v.order_index
  );

-- MODULES for MySQL Basics
INSERT INTO modules (course_id, title, order_index, duration)
SELECT c.id, v.title, v.order_index, v.duration
FROM courses c
CROSS JOIN (
  SELECT 'Introduction to Databases & SQL' AS title, 1 AS order_index, '20 min' AS duration UNION ALL
  SELECT 'Creating Databases & Tables' AS title, 2 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'INSERT, SELECT, UPDATE, DELETE' AS title, 3 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'WHERE Clauses & Filtering' AS title, 4 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'JOINs & Relationships' AS title, 5 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'Indexes & Query Optimization' AS title, 6 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Connecting MySQL with Node.js' AS title, 7 AS order_index, '35 min' AS duration
) AS v
WHERE c.title = 'MySQL Basics'
  AND NOT EXISTS (
    SELECT 1 FROM modules m
    WHERE m.course_id = c.id AND m.order_index = v.order_index
  );

-- MODULES for Git & GitHub
INSERT INTO modules (course_id, title, order_index, duration)
SELECT c.id, v.title, v.order_index, v.duration
FROM courses c
CROSS JOIN (
  SELECT 'Introduction to Version Control & Git' AS title, 1 AS order_index, '20 min' AS duration UNION ALL
  SELECT 'Git Init, Add, Commit' AS title, 2 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'Branches & Merging' AS title, 3 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'GitHub: Push, Pull, Clone' AS title, 4 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'Pull Requests & Collaboration' AS title, 5 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Git Workflow Best Practices' AS title, 6 AS order_index, '20 min' AS duration
) AS v
WHERE c.title = 'Git & GitHub'
  AND NOT EXISTS (
    SELECT 1 FROM modules m
    WHERE m.course_id = c.id AND m.order_index = v.order_index
  );

-- MODULES for C Programming
INSERT INTO modules (course_id, title, order_index, duration)
SELECT c.id, v.title, v.order_index, v.duration
FROM courses c
CROSS JOIN (
  SELECT 'Introduction to C & Setup' AS title, 1 AS order_index, '20 min' AS duration UNION ALL
  SELECT 'Variables, Data Types & Operators' AS title, 2 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'Conditions & Loops' AS title, 3 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Functions in C' AS title, 4 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Arrays & Strings' AS title, 5 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'Pointers & Memory Management' AS title, 6 AS order_index, '40 min' AS duration UNION ALL
  SELECT 'Structures & Unions' AS title, 7 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'File Handling in C' AS title, 8 AS order_index, '30 min' AS duration
) AS v
WHERE c.title = 'C Programming Basics'
  AND NOT EXISTS (
    SELECT 1 FROM modules m
    WHERE m.course_id = c.id AND m.order_index = v.order_index
  );

-- MODULES for Python Basics
INSERT INTO modules (course_id, title, order_index, duration)
SELECT c.id, v.title, v.order_index, v.duration
FROM courses c
CROSS JOIN (
  SELECT 'Introduction to Python & Setup' AS title, 1 AS order_index, '20 min' AS duration UNION ALL
  SELECT 'Variables, Data Types & Operators' AS title, 2 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'Conditions & Loops' AS title, 3 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'Functions & Modules' AS title, 4 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Lists, Tuples, Sets & Dicts' AS title, 5 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'File Handling & Error Handling' AS title, 6 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Object-Oriented Python (OOP)' AS title, 7 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'Python Libraries Overview' AS title, 8 AS order_index, '25 min' AS duration
) AS v
WHERE c.title = 'Python Basics'
  AND NOT EXISTS (
    SELECT 1 FROM modules m
    WHERE m.course_id = c.id AND m.order_index = v.order_index
  );

-- MODULES for DSA Basics
INSERT INTO modules (course_id, title, order_index, duration)
SELECT c.id, v.title, v.order_index, v.duration
FROM courses c
CROSS JOIN (
  SELECT 'Introduction to DSA & Big-O Notation' AS title, 1 AS order_index, '25 min' AS duration UNION ALL
  SELECT 'Arrays & Strings' AS title, 2 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Linked Lists' AS title, 3 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'Stacks & Queues' AS title, 4 AS order_index, '30 min' AS duration UNION ALL
  SELECT 'Recursion & Backtracking' AS title, 5 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'Trees & Binary Search Trees' AS title, 6 AS order_index, '40 min' AS duration UNION ALL
  SELECT 'Sorting Algorithms' AS title, 7 AS order_index, '40 min' AS duration UNION ALL
  SELECT 'Searching Algorithms & Hashing' AS title, 8 AS order_index, '35 min' AS duration UNION ALL
  SELECT 'Dynamic Programming Basics' AS title, 9 AS order_index, '45 min' AS duration UNION ALL
  SELECT 'Graphs & Graph Traversal' AS title, 10 AS order_index, '40 min' AS duration
) AS v
WHERE c.title = 'DSA Basics'
  AND NOT EXISTS (
    SELECT 1 FROM modules m
    WHERE m.course_id = c.id AND m.order_index = v.order_index
  );
