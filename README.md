# MyBA - AI Ticket Generator

## Development Workflow

### Development Mode (Hot Reload)
```bash
npm run dev
# Access at: http://152.42.141.162:3000
```

### Production Build & Deploy
```bash
./deploy.sh
# Access at: http://152.42.141.162/myba/
```

### Quick Commands
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production  
- `./deploy.sh` - Build and deploy to nginx

## Architecture
- **Frontend**: React + TanStack Router + TypeScript + Vite
- **Development**: Vite dev server on port 3000
- **Production**: Static files served by nginx at `/myba/`
- **No more permission issues**: Owned by user `raf`

## File Structure
```
/var/www/html/myba/
├── src/
│   ├── routes/
│   │   ├── __root.tsx
│   │   └── index.tsx
│   ├── main.tsx
│   └── routeTree.gen.ts
├── package.json
├── vite.config.ts
├── deploy.sh
└── index.html (built files)
```