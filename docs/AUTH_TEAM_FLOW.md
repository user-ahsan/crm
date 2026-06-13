# Auth + Team Flow — Implementation Update

## Sign Up Flow (Updated)

```
User fills signup form
  → Submit
  → Validate fields
  → Simulate auth delay
  → Set session cookies (auto-login)
  → Create default team via teamService.create()
  → Add user as 'admin' via teamMembers.push()
  → Store user + team info in sessionStorage
  → Redirect to /onboarding
```

**Key changes:**
- After auth simulation, call `teamService.create({ name: `${fullName}'s Team`, description: '' })`
- Then add the current user as admin to the team
- Pass team info to onboarding via sessionStorage

## Sign In Flow (Updated)

```
User fills login form
  → Submit
  → Validate
  → Simulate auth delay
  → Set session cookies (auto-login)
  → Check if user has a team (check teamMembers for user)
  → If team exists → redirect to /dashboard
  → If no team → redirect to /onboarding
```

**Key changes:**
- After login, check team membership
- Route based on team existence

## Onboarding Flow (Updated)

```
Step 0: Welcome (no change)
Step 1: Profile - Pre-fill name from signup, add job title
Step 2: Company - Team name pre-filled from signup, industry, size
  → On submit, UPDATE the team via teamService.update()
Step 3: Goals (no change)
Step 4: Complete - Show team summary
  → "Go to Dashboard" button
```

**Key changes:**
- Step 2 updates the team created during signup
- Team name defaults to what was created during signup
