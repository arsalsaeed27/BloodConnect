const jwt = require("jsonwebtoken");
const protect = (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      console.error("Token verification error:", error);
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, token failed" });
    }
  }
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, no token" });
  }
};

module.exports = { protect };
//  look at the HTTP header for a token, verify it, and attach the user to the request object if valid.

// defines an express.js middleware function that acts as a security layer for routes that require authentication. It checks for a JWT in the request headers, verifies it, and either allows the request to proceed or responds with an error if the token is missing or invalid.


const jwt = require('jsonwebtoken');

const authenticationToken = (req, res, next) => {
    // 1. Look for the "Authorization" header
    const authHeader = req.headers['authorization'];

    // 2. EXtract the token (Format is usually "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    const token = authHeader && authHeader.split(' ')[1];

    // 3. If no token is found, return a 401 Unauthorized response
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.',
            data: null,
            errors: ['Unauthorized Access']
        });
    }
    try{
        // 3. Verify the token using the secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. Attach the decoded VIP info to the request so the next function can see it
        req.user = decoded;  // This contains userId, role, and adminType

        // 5. Let the user pass to the next step
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token.',
            data: null,
            errors: ['Invalid Token']
        });

    }
};

module.exports = authenticationToken;
