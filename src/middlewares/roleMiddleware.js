//   once a user is authenticated, this middleware checks if the user has the required role to access certain routes. It compares the user's role against the allowed roles for that route and either allows the request to proceed or responds with an error if the user does not have the necessary permissions.

const verifying = (req, res, next) => {
    // ensure the user actually exists on the request AND has the 'admin' role
    if(req.user && req.user.role === 'admin') {
        next(); //let them through to normal admin tasks (like viewing donors)
    } else{
        return res.status(403).json({
            success: false,
            message: 'Access denied. You do not have permission to perform this action.',
            data: null,
            errors: ['Forbidden Access']
        })
    }
};

const verifySuperAdmin = (req, res, next) => {
    // ensure the user is an admin AND specifically has the 'super' type
    if(req.user && req.user.role === 'admin' && req.user.adminType === 'super') {
        next(); //let them through to super admin tasks (like managing other admins)
    } else{
        return res.status(403).json({
            success: false,
            message: 'Access denied. You do not have permission to perform this action.',
            data: null,
            errors: ['Forbidden Access']
        })
    }
};

module.exports = { verifying, verifySuperAdmin };