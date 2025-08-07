const i=[{title:"User Authentication Feature",content:`## 🎯 Feature: User Authentication System

### Summary
Implement a secure user authentication system with login, registration, and password reset functionality.

### Acceptance Criteria
- [ ] User can register with email and password
- [ ] User can log in with valid credentials
- [ ] User can reset password via email
- [ ] Session management with JWT tokens
- [ ] Input validation and error handling
- [ ] Rate limiting for security

### Technical Requirements
- Use bcrypt for password hashing
- Implement JWT for session management
- Add email verification for new accounts
- Include 2FA option for enhanced security

### Definition of Done
- All tests pass (unit + integration)
- Security review completed
- Documentation updated
- Deployed to staging environment

**Priority:** High
**Story Points:** 8
**Labels:** authentication, security, backend`},{title:"Dashboard Performance Optimization",content:`## ⚡ Epic: Dashboard Performance Improvements

### Problem Statement
Dashboard loading times are slow (>5s) affecting user experience and conversion rates.

### Success Metrics
- Reduce initial load time to <2s
- Improve Time to Interactive (TTI) by 60%
- Achieve Lighthouse score >90

### Implementation Plan
1. **Code Splitting**
   - Implement lazy loading for dashboard widgets
   - Split vendor bundles efficiently

2. **Data Optimization**
   - Add pagination for large datasets
   - Implement proper caching strategy
   - Optimize database queries

3. **UI Improvements**
   - Add skeleton loading states
   - Implement virtual scrolling
   - Optimize re-renders with React.memo

### Testing Strategy
- Performance budgets in CI/CD
- Load testing with realistic data volumes
- Monitor Core Web Vitals

**Estimated Effort:** 2-3 sprints
**Impact:** High user satisfaction improvement`},{title:"Mobile App Bug Fix",content:`## 🐛 Bug Report: App Crashes on Image Upload

### Description
Mobile app crashes consistently when users attempt to upload images larger than 5MB.

### Steps to Reproduce
1. Open camera/gallery picker
2. Select image >5MB
3. Tap "Upload"
4. App crashes immediately

### Expected Behavior
- Large images should be compressed automatically
- User should see progress indicator
- Upload should complete successfully

### Current Behavior
- App crashes without error message
- User loses all form data
- No feedback about file size limits

### Technical Details
- **Platform:** iOS 16+, Android 12+
- **Crash Rate:** 15% of image uploads
- **Error:** OutOfMemoryError (Android), EXC_BAD_ACCESS (iOS)

### Proposed Solution
1. Add client-side image compression
2. Implement file size validation
3. Add proper error handling
4. Show upload progress

### Acceptance Criteria
- [ ] Images >5MB compressed before upload
- [ ] Clear error messages for oversized files
- [ ] No data loss on upload failure
- [ ] Works on all supported devices

**Severity:** Critical
**Priority:** P1 - Immediate`}];async function a(s){await new Promise(r=>setTimeout(r,2e3+Math.random()*2e3));let t=i[0];const e=s.toLowerCase();return e.includes("bug")||e.includes("crash")||e.includes("error")||e.includes("fix")?t=i[2]:e.includes("performance")||e.includes("slow")||e.includes("speed")||e.includes("optimize")?t=i[1]:e.includes("login")||e.includes("auth")||e.includes("user")||e.includes("account")?t=i[0]:t={title:"Custom Feature Request",content:`## 🎯 Feature Request: Custom Implementation

### User Requirements
${s}

### Summary
Implement the requested feature based on user specifications above.

### Acceptance Criteria
- [ ] Feature meets user requirements
- [ ] Proper error handling implemented
- [ ] Unit tests written and passing
- [ ] Documentation updated
- [ ] Responsive design for mobile

### Technical Considerations
- Evaluate impact on existing functionality
- Consider scalability requirements
- Plan for proper testing coverage
- Review security implications

### Definition of Done
- [ ] Code review completed
- [ ] All tests passing
- [ ] QA validation successful
- [ ] Deployed to production

**Priority:** Medium
**Story Points:** TBD
**Labels:** feature-request, needs-refinement`},t}export{a as generateTicket};
