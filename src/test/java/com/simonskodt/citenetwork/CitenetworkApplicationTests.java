package com.simonskodt.citenetwork;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class CitenetworkApplicationTests {

	@Test
	void simpleTest() {
		assertNotEquals(1, 2);
	}
}
