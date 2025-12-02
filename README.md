# QA Agent Pro

AI-powered test case generation and analysis tool built with React and TypeScript.

## Features

- 🤖 AI-powered test case generation using Anthropic's Claude API
- 🔄 **Auto-continuation** - Handles unlimited response lengths automatically
- 📊 Gap analysis for user stories
- ✅ Comprehensive test case management
- 💬 Interactive chat interface
- 📝 Export test cases and analysis
- 🎯 Test coverage analysis
- 🚫 No more JSON parse errors or truncated responses!

## Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Anthropic API key (get one at https://console.anthropic.com/)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd qa-agent
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd server
npm install
cd ..
```

4. Configure your Anthropic API key:
   - Copy `server/.env.example` to `server/.env`
   - Add your API key to `server/.env`:
```
ANTHROPIC_API_KEY=your_actual_api_key_here
PORT=5000
```

## Development

1. Start the backend server (in a terminal):
```bash
cd server
npm start
```

2. Start the frontend (in another terminal):
```bash
npm start
```

- Backend API: [http://localhost:5000](http://localhost:5000)
- Frontend App: [http://localhost:3000](http://localhost:3000)

## Build for Production

Create an optimized production build:
```bash
npm run build
```

The build output will be in the `build/` directory.

## Docker

Build and run using Docker:

```bash
# Build the image
docker build -t qa-agent-pro .

# Run the container (make sure to set your API key)
docker run -p 7320:7320 -p 5000:5000 \
  -e ANTHROPIC_API_KEY=your_api_key_here \
  qa-agent-pro
```

The application will be available at [http://localhost:7320](http://localhost:7320)

**Note**: When using Docker, you must pass the `ANTHROPIC_API_KEY` environment variable at runtime.

## Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Usage

1. **Select Analysis Type**: Choose between "Analysis only" or "Generate test cases"
2. **Enter User Story**: Paste or upload your user story
3. **Generate**: Click generate to analyze and create test cases
4. **Review Results**: View generated test cases, analysis, and coverage metrics
5. **Export**: Download results in various formats
6. **Chat**: Use the interactive chat for refinements

## Technologies

- React 18
- TypeScript
- Webpack 5
- Lucide React (Icons)
- Anthropic Claude API
- TailwindCSS

## License

Proprietary - AIM Technologies

## Advanced Features

### Auto-Continuation
The app automatically handles truncated responses by making multiple API requests and stitching them together. This means:
- ✅ No response size limits
- ✅ No JSON parse errors
- ✅ Handles large user stories automatically
- ✅ Progress tracking in console

See [AUTO_CONTINUATION.md](AUTO_CONTINUATION.md) for details.

## Troubleshooting

Having issues? Check out [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common problems and solutions:
- JSON Parse Errors
- CORS Issues
- Connection Problems
- Performance Tips

## Support

For support and questions, contact AIM Technologies.
# qa-agent
