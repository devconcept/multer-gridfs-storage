1.3.0
=====

  * Fix: Renamed 'error' event to 'streamError' to prevent a bug where the
  the user does not set any listener for that event and emitting it causes the
  program to crash.

1.2.2
=====

  * Added 'dbError' event
  * Call log function in 'error' event

1.2.1
=====

  * Added 'error' event

1.2.0
=====

  * Added generator function support
  * Allow to use promises in configuration options instead of callbacks

1.1.1
=====

  * Fixed UnhandledPromiseRejection error
  

1.1.0
==================

  * Added support for connection promises
  * Added file size information
  * Allow the api to be called with the `new` operator
  * Added Typescript support

1.0.3
==================

  * Fixed code coverage

1.0.2
==================

  * Changed log option to accept a function

1.0.1
==================

  * Added validation for options

1.0.0
==================

  * Initial stable release
  
0.0.5
==================
  
  * Added support for changing the default collection with the root option
  
0.0.4
==================
  
  * Added support for changing the chunk size
  
0.0.3
==================
  
  * First release
