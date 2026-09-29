# Contributing

Do you like this library and want to get involved? We would love for you to contribute and help make it even better. As a contributor, here are the guidelines we would like you to follow.

## Code of Conduct

This library is open and inclusive. Please read and follow our [Code of Conduct][coc].

## Questions

First make sure your question is entirely related to this library and not to MongoDB or Multer. You can find answers for those on Stack Overflow and in their GitHub repositories.

Search the issues, including closed ones, using keywords for your problem. There is a possibility that someone had the same problem before and there is already a fix available. You can also ask in [GitHub Discussions](https://github.com/devconcept/multer-gridfs-storage/discussions) or try Stack Overflow; you will find thousands of developers willing to help there and the solutions might help other people with the same problem as you.

[coc]: https://github.com/devconcept/multer-gridfs-storage/blob/master/CODE_OF_CONDUCT.md

## Bugs and features

If you found a bug you are welcome to report it by submitting an issue. You can also open a pull request if you are confident you can fix it, but make sure to open the issue first and discuss the problem. The same applies for new features, big or small. This helps coordinate our efforts and prevent duplication of work.

Try not to pollute your changes trying to address several issues at once. Keep them simple and focused on one single problem. You can open a new PR or issue to solve the others.

Provide a demo via a GitHub repository, StackBlitz or CodePen with the problem you found. We need to confirm it actually exists before proceeding to fix it. Saving us time will serve to fix more bugs and help more people.

## Pull request

Make sure you follow all of the steps mentioned here as they ensure your changes are accepted and merged quickly:

Click the Fork button to create your personal fork of this repository

Clone your copy using git

Run `npm install` to download and install dependencies. Node.js 22 or later is required.

Create a new branch for your changes

```shell
git checkout -b my-fix-branch develop
```

Fix the bug or add the feature you want

Add the required tests to make sure your code works and run the test suite ensuring all tests pass. The tests need a MongoDB server reachable at `127.0.0.1:27017` (override with the `MONGO_HOST` / `MONGO_PORT` environment variables); if you have Docker you can start a throwaway one with `npm run db:up` (and stop it with `npm run db:down`).

```shell
npm run db:up
npm test
```

If possible make sure code coverage didn't decrease. Run `npm run coverage` and open the HTML report generated in the `coverage` folder.

Lint and format the code using `npm run lint` and fix any issues that cannot be solved automatically. You can also run `npm run typecheck` to check types. If you change the public API, update the JSDoc comments accordingly.

Commit your changes using a descriptive commit message that gives us an idea of what you did.

Push your branch to GitHub

```shell
git push origin my-fix-branch
```

Open GitHub and send a pull request to the `develop` branch. The `master` branch only receives releases.

Check the results of the GitHub Actions build

Keep adding commits with more changes if needed.

After the pull request is merged, you can delete your branch and update your local copy from the upstream repository.
