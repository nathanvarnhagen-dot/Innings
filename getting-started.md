# Getting started with Innings

This guide explains how to run Innings on a new Windows or Mac computer. You do not need programming experience. The initial setup usually takes about 10–20 minutes.

## Before you begin

You will need:

- An internet connection for the first setup
- A GitHub account with permission to access the Innings repository, if the repository is private
- Permission to use the Innings Firebase project if you want sign-in, saved data, and photo uploads to work
- A US mobile number that can receive the sign-in text message

## 1. Install Node.js

Node.js is the program that runs the app's development tools. You only need to install it once.

1. Go to [nodejs.org](https://nodejs.org/).
2. Download the version marked **LTS** (Long Term Support).
3. Open the downloaded installer.
4. Accept the normal/default choices and finish the installation.
5. If the installer asks whether it may make changes to your computer, choose **Yes**.

The Node.js installer also installs `npm`, the tool that downloads everything the project needs. See GitHub's [Node.js installation guidance](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs) if you need more background.

## 2. Install Git

Git is the tool that copies the project from GitHub to your computer and lets you receive later updates.

Follow GitHub's short [Install Git guide](https://github.com/git-guides/install-git) for Windows or Mac. Accept the installer's normal/default choices.

## 3. Open a command-line window

The command line is a text-based way to tell your computer what to do. You will enter one short command at a time and press **Enter** after each one.

### On Windows

Open the Start menu, type **PowerShell**, and open **Windows PowerShell** or **Terminal**.

### On a Mac

Press **Command + Space**, type **Terminal**, and press **Return**.

## 4. Check that Node.js and Git are ready

Enter:

```bash
node --version
```

You should see a version beginning with `v`, such as `v22`. Then enter:

```bash
npm --version
```

You should see another version number. If the computer says either command is not recognized or not found, close the command-line window, open it again, and retry. If it still fails, reinstall the current LTS version of Node.js.

Now enter:

```bash
git --version
```

You should see a line beginning with `git version`. If Git is not recognized, close and reopen the command-line window. Reinstall Git if the problem continues.

## 5. Download the project from GitHub

Choose a convenient place for the project, such as your Documents folder. Then enter this command:

```bash
git clone https://github.com/nathanvarnhagen-dot/Innings.git
```

Git creates a new folder named `Innings` and downloads the project into it. If GitHub asks you to sign in, follow the instructions shown in the browser or command-line window. See GitHub's [Cloning a repository guide](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) for additional help.

If someone gave you a ZIP file instead, you can skip the `git clone` command: double-click the ZIP to unpack it and use that unpacked Innings folder in the next step.

## 6. Move the command line into the project folder

If you used `git clone`, enter:

```bash
cd Innings
```

If you unpacked a ZIP file or saved the folder somewhere else, type `cd` followed by a space, but do not press Enter yet:

```text
cd 
```

Now drag the unpacked **Innings** folder from Finder or File Explorer into the command-line window. The computer will add the folder's location after `cd`. Press **Enter**.

For example, the finished command may look like:

```text
cd /Users/your-name/Downloads/Innings
```

It is normal for your path to look different. Leave this command-line window open for the remaining steps.

## 7. Download the app's dependencies

Enter:

```bash
npm install
```

This downloads the supporting packages listed in the project. It can take several minutes. Warnings may appear and do not always mean setup failed. Continue when the command finishes and you can type again. If you see a clear `npm ERR!` message, check your internet connection and run `npm install` one more time.

## 8. Start Innings

Enter:

```bash
npm run dev
```

After a moment, the command line will show a local address, usually:

```text
http://localhost:5173/
```

Hold **Control** (Windows) or **Command** (Mac) and click that address. If it is not clickable, copy it into Chrome, Edge, Firefox, or Safari.

Keep the command-line window open while using the app. Closing it stops Innings.

## 9. Sign in for the first time

In the browser:

1. Enter a 10-digit US mobile number.
2. Select **Send code**.
3. Enter the six-digit code received by text message.
4. Enter your name.
5. Select **Start your innings**.

If you are using Safari on an iPhone, Innings may show instructions for adding the app to your Home Screen. This is optional; you can choose **Skip for now**.

Phone sign-in uses the shared Firebase service, not just your computer. If no text arrives or the app reports that it cannot send the code, ask the project's technical owner to check that Phone Authentication is enabled, the United States is allowed by the SMS region policy, `localhost` is an authorized domain, and the SMS quota has not been reached.

## Using Innings from another device

`localhost` means “this computer,” so the address shown above normally works only on the computer running Innings. The simplest way to use the app on a phone is to open its deployed web address, if the project owner has provided one.

Running the unfinished local version directly on another device requires network and Firebase configuration. Ask the project's technical owner to help with that setup.

## Stopping and starting later

To stop the app, return to the command-line window and press **Control + C**. On Windows, you may be asked to confirm; type `Y` and press **Enter**.

The next time you want to run Innings:

1. Open PowerShell/Terminal.
2. Use `cd` to enter the Innings folder again, as described in step 6.
3. Enter `npm run dev`.
4. Open the address shown in the window.

You do not normally need to repeat `npm install`. Run it again only when the project dependencies have changed or the technical owner asks you to.

## Common problems

### The browser says it cannot reach the page

Make sure the command-line window is still open and `npm run dev` is still running. Use the exact address printed there; its number can sometimes differ from `5173`.

### The command says `npm` or `node` is not recognized

Install the current LTS version of Node.js, then completely close and reopen PowerShell/Terminal.

### The command says it cannot find `package.json`

The command line is in the wrong folder. Repeat step 6 and make sure you choose the Innings folder that contains `package.json`.

### Port 5173 is already in use

Vite will usually choose another number automatically. Open the new address it prints. You can also stop an older Innings window with **Control + C**.

### No sign-in text arrives

Confirm that the phone number is a valid 10-digit US number. If retrying once does not help, contact the project's technical owner; repeated attempts can trigger temporary SMS limits.

### A red error appears during `npm install`

Check the internet connection, close the command-line window, reopen it in the project folder, and retry `npm install`. If it still fails, copy the complete error message and send it to the project's technical owner.
