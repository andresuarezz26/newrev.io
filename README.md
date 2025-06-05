# Newrev

**Newrev** is an AI code generator that runs on the browser. Built on top of [aider](https://github.com/paul-gauthier/aider), Newrev provides a seamless human-AI collaboration environment where you can edit, iterate, and ship production-ready code.

---

## 🚀 Features

* Edit any GitHub project collaboratively with AI
* Built on top of [aider](https://github.com/paul-gauthier/aider)
* Supports more than 100 programming languages
* Live preview available for front end projects

---

## 🧰 Requirements

* [Node.js](https://nodejs.org/)
* [Python 3.10+](https://www.python.org/)
* An [Anthropic API key](https://www.anthropic.com/)

---

## 🛠️ Getting Started

Follow these steps to run Newrev locally.

### 1. Clone the repository

```bash
git clone https://github.com/andresuarezz26/newrev.git
cd newrev
```

---

### 2. Set up the backend

```bash
cd api
pip install -r requirements.txt
pip install -e .. 
```

Then run the backend server go the github folder of the project you want to edit and do the following:

```bash
python3 ../newrev/app.py --model sonnet --api-key anthropic=[your anthropic API key]
```

The backend will start on:
📍 `http://localhost:5000`

---

### 3. Set up the frontend

```bash
cd ../newrev/client
npm install
npm run dev
```

The frontend will be available at:
🌐 `http://localhost:3000`

---

### 4. Open the browser

* Open the front end project in the browser:
🌐 `http://localhost:3000`

---

## 📂 Project Structure

```
newrev/
├── aider/      # The Aider source code
├── api/        # Python backend
├── client/     # Frontend (Next.js + Node.js)
└── README.md   # You are here!
```

---

## 🙌 Contributing

We're just getting started. Contributions, ideas, and PRs are welcome! Feel free to [open an issue](https://github.com/andresuarezz26/newrev/issues) or suggest features.

---

