# di-sacala

[![Tests](https://github.com/monkin/di-sacala/actions/workflows/test.yml/badge.svg)](https://github.com/monkin/di-sacala/actions/workflows/test.yml)

`di-sacala` is a lightweight, type-safe dependency injection container for TypeScript. It leverages TypeScript's advanced type system to provide a fluent API for service registration and resolution with full type safety and autocompletion.

## Features

- **Full Type Safety**: Get autocompletion and type checks for all your injected services.
- **Fluent API**: Chainable service registration makes it easy to compose your container.
- **Container Composition**: Merge multiple containers together to share dependencies across different parts of your application.
- **Lazy Construction**: Services are instantiated only on demand (when first accessed).
- **Zero Runtime Dependencies**: Extremely lightweight.

## Installation

```bash
npm install di-sacala
```

## Usage

### 1. Defining a Service

A service is a class that implements the `DiService` interface. It must implement a `getName()` method which will be used as the key in the container. Use `as const` to ensure the name is treated as a literal type.

```typescript
import { DiService } from 'di-sacala';

export class LoggerService implements DiService<"logger"> {
    getName() {
        return "logger" as const;
    }
    
    log(message: string) {
        console.log(`[LOG]: ${message}`);
    }
}
```

### 2. Basic Injection

Use `DiContainer` to register and resolve your services.

```typescript
import { DiContainer } from 'di-sacala';
import { LoggerService } from './LoggerService';

const container = new DiContainer()
    .inject(LoggerService);

// Access the service directly on the container
container.logger.log("Service is ready!");
```

### 3. Services with Dependencies

To inject dependencies into a service, define its constructor to accept the container. You can use the `Di` type helper to specify which services are required.

```typescript
import { Di, DiService } from 'di-sacala';
import { LoggerService } from './LoggerService';

export class UserService implements DiService<"user"> {
    getName() {
        return "user" as const;
    }
    
    // Use Di<ServiceType> or Di<[Service1, Service2]> for type-safe dependencies
    constructor(private di: Di<LoggerService>) {}

    getUser(id: string) {
        this.di.logger.log(`Fetching user: ${id}`);
        return { id, name: "User " + id };
    }
}

const container = new DiContainer()
    .inject(LoggerService)
    .inject(UserService);

container.user.getUser("42");
```

### 4. Merging Containers

You can create specialized containers and merge them into a main container using `injectContainer`.

```typescript
const authContainer = new DiContainer().inject(AuthService);
const apiContainer = new DiContainer().inject(ApiService);

const appContainer = new DiContainer()
    .injectContainer(authContainer)
    .injectContainer(apiContainer)
    .inject(MainApp);
```

### 5. Lazy Construction

Services registered via `inject` are only instantiated when they are first accessed. This allows for efficient container initialization and avoids unnecessary work for services that might not be used in certain execution paths.

```typescript
const container = new DiContainer()
    .inject(ExpensiveService);

// ExpensiveService is NOT instantiated yet

console.log("Container ready");

// ExpensiveService is instantiated NOW
container.expensive.doSomething();
```

### 6. Duplicate Service Name Protection

`di-sacala` prevents registering multiple services with the same name. This protection works at both compile-time and runtime:

- **Type-level Check**: If you try to `inject` a service with a name that already exists in the container, TypeScript will report an error, and the resulting type will be a string literal describing the error.
- **Runtime Check**: The `inject` and `injectContainer` methods will throw an `Error` if a duplicate key is detected.

```typescript
const container = new DiContainer()
    .inject(LoggerService);

// TypeScript Error: Type '"Duplicate service name: logger"' ...
// Runtime Error: Duplicate service name: logger
container.inject(AnotherLoggerService); 
```

## Development

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
npm run test:watch  # Watch mode
```

### Linting & Formatting

```bash
npm run lint          # Run ESLint
npm run format        # Format code with Prettier
npm run format:check  # Check code formatting
```

## License

MIT

