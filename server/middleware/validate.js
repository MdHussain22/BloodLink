export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Please check the submitted fields",
        errors: parsed.error.issues.map(issue => ({ field: issue.path.join("."), message: issue.message }))
      });
    }
    req.body = parsed.data;
    next();
  };
}
