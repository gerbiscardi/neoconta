# NeoConta Agent Rules

- **GitHub Synchronization Protocol:** At the end of each task or code modification, once changes have been successfully verified (compiling and working), the agent must automatically stage, commit, and push the changes to GitHub (`main` branch) and notify the user about the synchronization.
- **Privacy Protections:** Always respect the `.gitignore` rules (never force add files in `/data/` or other excluded paths).
