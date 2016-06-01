# JDCloud - 筋斗云移动应用框架

筋斗云框架是用于移动产品开发的一揽子解决方案。

筋斗云的设计思想是 **做优雅的全平台应用**，可以制作各类移动端（如安卓、苹果平台）或桌面端（如Windows等桌面系统）的Web应用和原生应用，以移动端应用为产品主要方式，同时强调优雅的开发，优雅的发布和优雅的用户体验。

筋斗云的架构符合[DACA规范](https://github.com/skyshore2001/daca)（DACA: Distributed Access and Control Architecture，分布式访问和控制架构），严格区分前端应用与后端应用服务器，两者之间通过BQP协议（BQP: Business Query Protocol，业务查询协议）交互。其前端提供移动风格和桌面风格两种Web应用框架，以Html5为核心技术，并对移动端或桌面端原生应用给予良好支持，移动Web应用框架可以用于制作安卓或苹果原生应用、微信公众号等应用平台上的轻应用，桌面Web应用框架常用于创建桌面风格的管理端应用程序，形式上也可以是Web应用或Windows/Linux应用程序等，覆盖全平台。后端应用服务器仅提供业务数据查询，不掺杂视图等其它数据，统一服务各种前端应用。筋斗云的前后端均可独立使用。

筋斗云前端开发使用POM开发模型（POM: Page object model，页面对象模型），以逻辑页做为基本开发单元，使得制作Web应用的开发体验与制作原生应用类似。通过名为Webcc的应用部署工具，支持应用性能优化（比如针对缓存及CDN优化），一键产品上线，有力地支持产品的持续更新。

筋斗云后端注重设计文档，以严谨而简约的方式描述数据模型及业务接口，进而自动创建或更新数据库（称为“一站式数据模型部署”），以及进行接口API声明或测试。后端框架以php编程语言实现了DACA规范，可以很方便扩展业务接口和实行访问控制，还支持各种后端应用（如定期任务，服务器维护工具等）。

筋斗云对测试和持续更新（CI）非常重视，也提供了诸多支持，包括手工测试工具，测试流程管理，基于phpunit的服务端业务接口自动化测试框架，以及基于NUnit+.Net开发的业务流程自动化测试框架等。

