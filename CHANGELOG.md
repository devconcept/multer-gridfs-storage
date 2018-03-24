# 3.0.1

 * Fix: Changed mongodb dependency version from 3 to >=2

# 3.0.0

 * Feature: Added support for mongodb version 3 in url connection string
 * Feature: Added `client` property to storage object

# 2.1.0

 * Feature: Allowed strings, numbers and null values as file configuration
 * Fix: Added examples to the readme

# 2.0.0

 * Breaking change: Removed gridfs-stream dependency
 * Breaking change: Removed all old file configuration options
 * Breaking change: Removed logging functions
 * Breaking change: The grid property in the file object was removed and its properties merged directly with the file object
 * Feature: Simplified api by adding a new option `file` to control file configuration
 * Feature: Added delayed file storage after successful connection instead of failing with an error

# 1.3.0

  * Fix: Renamed 'error' event to 'streamError' to prevent a bug where the the user does not set any listener for that event and emitting it causes the program to crash.


# 1.2.2

  * Feature: Added 'dbError' event
  * Fix: Call log function in 'error' event

# 1.2.1

  * Feature: Added 'error' event

# 1.2.0

  * Feature: Added generator function support
  * Feature: Allow to use promises in configuration options instead of callbacks

# 1.1.1

  * Fix: Fixed UnhandledPromiseRejection error
  

# 1.1.0

  * Feature: Added support for connection promises
  * Feature: Added file size information
  * Feature: Allow the api to be called with the `new` operator
  * Feature: Added Typescript support

# 1.0.3

  * Fix: Fixed code coverage

# 1.0.2

  * Feature: Changed log option to accept a function

# 1.0.1

  * Fix: Added validation for options

# 1.0.0

  * Initial stable release
  
# 0.0.5
  
  * Feature: Added support for changing the default collection with the root option
  
# 0.0.4
  
  * Feature: Added support for changing the chunk size
  
# 0.0.3
  
  * First release
