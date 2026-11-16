cmake_minimum_required(VERSION 3.16)
project(aig_package LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(aig_lib STATIC
    src/aig.cpp
    src/aiger.cpp
    src/blif.cpp
    src/optimizer.cpp
    src/graph.cpp
    src/expr.cpp
    src/aig_facade.cpp
)
target_include_directories(aig_lib PUBLIC src)
target_compile_options(aig_lib PRIVATE -Wall -Wextra)

add_executable(aig src/main.cpp)
target_link_libraries(aig PRIVATE aig_lib)

enable_testing()
add_executable(run_tests tests/test_aig.cpp)
target_include_directories(run_tests PRIVATE tests)
target_link_libraries(run_tests PRIVATE aig_lib)
add_test(NAME aig_tests COMMAND run_tests WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
