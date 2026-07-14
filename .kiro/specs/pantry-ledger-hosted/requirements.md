# Requirements Document

## Introduction

Pantry Ledger is an existing single-page React application that tracks grocery trips, items, spending, and item statuses. This feature converts it into a hosted full-stack web application running on Vercel with Supabase as the database backend, Upstash Redis for rate limiting, and Next.js as the framework. The hosted version adds user authentication, multi-device shared grocery list access, and a rate-limited API route for AI agent integrations — while preserving the existing UI and data model.

## Glossary

- **System**: The Pantry Ledger hosted web application as a whole
- **Auth_Service**: The Supabase authentication subsystem used to verify user identity
- **Database**: The Supabase PostgreSQL database storing trips, items, and user data
- **Rate_Limiter**: The Upstash Redis-backed middleware that enforces API call quotas
- **API**: The Next.js API routes that expose grocery list operations over HTTP
- **UI**: The existing React frontend (tabs: Overview, Add Trip, History) served by Next.js
- **User**: A registered person who has claimed a username and set a password
- **Session**: An authenticated browser or device session bound to a User
- **Trip**: A single grocery shopping event containing items, fees, store name, and date
- **Item**: A single grocery product within a Trip with name, category, price, quantity, and status
- **Category**: One of the fixed set of item classifications: produce, meat, dairy, bakery, frozen, pantry, snacks, beverages, condiments, deli, household, other
- **Status**: One of the four item lifecycle states: pending, used, partial, wasted
- **AI_Agent**: An external automated client that interacts with the System via the AI API route using a Bearer token

---

## Requirements

### Requirement 1: User Registration

**User Story:** As a new user, I want to claim a unique username and set a password, so that I can create my own shared grocery list identity.

#### Acceptance Criteria

1. THE Auth_Service SHALL accept a registration request containing a username and a plaintext password.
2. WHEN a registration request is received, THE Auth_Service SHALL reject usernames shorter than 3 characters or longer than 32 characters with a descriptive error message.
3. WHEN a registration request is received, THE Auth_Service SHALL reject passwords shorter than 8 characters with a descriptive error message.
4. WHEN a registration request is received with a username that already exists, THE Auth_Service SHALL return an error indicating the username is taken.
5. WHEN a valid registration request is received, THE Auth_Service SHALL store the username and a bcrypt-hashed password in the Database and create a new Session for the User.
6. THE Auth_Service SHALL enforce usernames containing only alphanumeric characters, hyphens, and underscores.

---

### Requirement 2: User Login

**User Story:** As a registered user, I want to log in with my username and password from any device, so that I can access my shared grocery list.

#### Acceptance Criteria

1. WHEN a login request is received with a valid username and matching password, THE Auth_Service SHALL create a Session and return a signed session token to the client.
2. WHEN a login request is received with an unrecognized username or incorrect password, THE Auth_Service SHALL return a generic "invalid credentials" error without revealing which field is incorrect.
3. WHEN a login request is received, THE Auth_Service SHALL complete the credential check within 2000ms.
4. THE UI SHALL display a login form collecting username and password fields.
5. WHEN a Session token expires, THE UI SHALL redirect the User to the login page.
6. THE Auth_Service SHALL set Session token expiry to 30 days.

---

### Requirement 3: Multi-Device Shared Access

**User Story:** As a user with multiple devices, I want all my devices to read and write the same grocery list, so that my household stays in sync.

#### Acceptance Criteria

1. WHEN an authenticated User creates, updates, or deletes a Trip or Item, THE Database SHALL persist the change and make it visible to all Sessions belonging to that User.
2. THE API SHALL scope all Trip and Item queries by the authenticated User's identifier so that no User can read or modify another User's data.
3. WHEN two Sessions belonging to the same User submit conflicting updates to the same Item simultaneously, THE Database SHALL apply the update with the later server-side timestamp and return the resolved state to both clients.
4. THE UI SHALL reload Trip and Item data from the API on each page load and after each mutation.

---

### Requirement 4: Trip Management

**User Story:** As a user, I want to create, view, and edit grocery trips, so that I can maintain a complete history of my shopping.

#### Acceptance Criteria

1. WHEN an authenticated User submits a new Trip with a store name, date, list of Items, and optional fees, THE API SHALL persist the Trip and its Items to the Database and return the created Trip with its assigned identifier.
2. WHEN an authenticated User requests the Trip list, THE API SHALL return all Trips belonging to that User ordered by date descending.
3. WHEN an authenticated User updates an existing Trip, THE API SHALL apply the changes to the Database and return the updated Trip.
4. WHEN an authenticated User deletes a Trip, THE API SHALL remove the Trip and all associated Items from the Database.
5. IF a Trip submission is received without a store name or date, THEN THE API SHALL return a 400 error with a descriptive message identifying the missing fields.

---

### Requirement 5: Item Management

**User Story:** As a user, I want to add and update items within a trip, including their category, price, quantity, and status, so that I can track what I bought and how it was used.

#### Acceptance Criteria

1. WHEN an authenticated User adds an Item to a Trip, THE API SHALL validate that the Item's category is one of: produce, meat, dairy, bakery, frozen, pantry, snacks, beverages, condiments, deli, household, or other.
2. WHEN an authenticated User adds an Item to a Trip, THE API SHALL validate that the Item's status is one of: pending, used, partial, or wasted.
3. IF an Item is submitted with an invalid category or status value, THEN THE API SHALL return a 400 error identifying the invalid field and value.
4. WHEN an authenticated User updates an Item's status, THE API SHALL persist the new status and return the updated Item.
5. THE API SHALL accept Item price as a non-negative decimal number with up to two decimal places.
6. THE API SHALL accept Item quantity as a positive integer.

---

### Requirement 6: Spend Analytics

**User Story:** As a user, I want to view spending summaries and charts by category, so that I can understand my grocery habits.

#### Acceptance Criteria

1. WHEN an authenticated User views the Overview tab, THE UI SHALL display a bar chart of total spend grouped by Category across all Trips using the existing Recharts implementation.
2. WHEN an authenticated User views the Overview tab, THE UI SHALL display total spend, average trip cost, and item count summary statistics sourced from the Database.
3. THE UI SHALL compute spend analytics client-side from Trip and Item data returned by the API.

---

### Requirement 7: Trip History View

**User Story:** As a user, I want to browse past trips and edit item statuses from a receipt-style card view, so that I can mark items as used, partial, or wasted after shopping.

#### Acceptance Criteria

1. WHEN an authenticated User views the History tab, THE UI SHALL display all Trips as receipt-style cards ordered by date descending.
2. WHEN an authenticated User changes an Item's status in the History tab, THE UI SHALL send an update request to the API and reflect the confirmed new status upon a successful response.
3. IF an Item status update request fails, THEN THE UI SHALL display an error message and revert the displayed status to the previous value.

---

### Requirement 8: AI Agent API

**User Story:** As a power user, I want an API endpoint that AI agents can call to read and update my grocery list, so that I can automate pantry management from my devices.

#### Acceptance Criteria

1. THE API SHALL expose a dedicated route at `/api/ai/items` accepting GET and PATCH requests authenticated via a Bearer token in the Authorization header.
2. WHEN a GET request is received at `/api/ai/items` with a valid Bearer token, THE API SHALL return the current Item list for the authenticated User in JSON format.
3. WHEN a PATCH request is received at `/api/ai/items` with a valid Bearer token and a valid Item update payload, THE API SHALL apply the update to the Database and return the updated Item.
4. WHEN a request is received at `/api/ai/items` without a valid Bearer token, THE API SHALL return a 401 error.
5. IF an invalid or malformed Item update payload is received at `/api/ai/items`, THEN THE API SHALL return a 400 error with a descriptive message.
6. THE Rate_Limiter SHALL enforce a limit of 60 requests per User per hour on the `/api/ai/items` route.
7. WHEN the rate limit for a User is exceeded, THE Rate_Limiter SHALL return a 429 response with a `Retry-After` header indicating the number of seconds until the limit resets.
8. WHEN a rate-limited request is received, THE Rate_Limiter SHALL check and decrement the User's request count in Upstash Redis before the API handler executes.

---

### Requirement 9: AI Agent Token Management

**User Story:** As a user, I want to generate and revoke API tokens for AI agents, so that I can control which clients have access to my grocery list.

#### Acceptance Criteria

1. WHEN an authenticated User requests a new AI token, THE Auth_Service SHALL generate a cryptographically random token of at least 32 bytes, store a hash of the token in the Database associated with the User, and return the plaintext token to the User exactly once.
2. WHEN an authenticated User revokes an AI token, THE Auth_Service SHALL delete the token hash from the Database, and THE API SHALL reject subsequent requests using that token with a 401 error.
3. THE UI SHALL display a token management section where the User can view active token metadata (creation date, last used date) and revoke tokens.
4. THE Auth_Service SHALL support a maximum of 5 active AI tokens per User.
5. IF a User attempts to create a 6th AI token, THEN THE Auth_Service SHALL return an error instructing the User to revoke an existing token first.

---

### Requirement 10: Data Migration from Local Storage

**User Story:** As an existing user of the single-page app, I want to import my locally stored data into the hosted app, so that I don't lose my trip history when switching.

#### Acceptance Criteria

1. THE UI SHALL provide an import function that accepts a JSON export of the existing localStorage data format.
2. WHEN an authenticated User submits a valid import payload, THE API SHALL parse the payload and create corresponding Trip and Item records in the Database for that User.
3. IF the import payload contains a Trip or Item with a field that violates validation rules (invalid category, invalid status, missing required field), THEN THE API SHALL skip the invalid record, continue processing remaining records, and return a summary listing skipped records with reasons.
4. THE UI SHALL display the import result summary, including the count of successfully imported Trips and any skipped records.

---

### Requirement 11: Deployment and Hosting

**User Story:** As the operator, I want the application deployed on Vercel's free tier with Supabase and Upstash, so that it is publicly accessible at zero infrastructure cost.

#### Acceptance Criteria

1. THE System SHALL be implemented as a Next.js application deployable to Vercel's free tier without exceeding free-tier function invocation or bandwidth limits under normal single-user household usage.
2. THE System SHALL connect to a Supabase project using environment variables for the database URL and API keys, with no credentials hardcoded in source files.
3. THE System SHALL connect to Upstash Redis using environment variables for the Redis URL and token, with no credentials hardcoded in source files.
4. WHEN environment variables required for Database or Rate_Limiter connectivity are absent at startup, THE System SHALL log a descriptive error and refuse to serve API requests until the configuration is corrected.
5. THE System SHALL serve the UI as a statically optimized Next.js application with API routes handled by Vercel serverless functions.
