function clearDigitalResidue() {
  try {
    // 캐시 삭제
    execSync('sudo apt-get clean');
    execSync('sudo apt-get autoclean');

    // 임시 파일 삭제
    execSync('sudo rm -rf /tmp/*');
    execSync('sudo rm -rf /var/tmp/*');

    // DNS 캐시 초기화
    execSync('sudo systemd-resolve --flush-caches');

    console.log('🧹 디지털 잔여물 제거 완료');
    return true;
  } catch (error) {
    console.error('잔여물 제거 실패:', error);
    return false;
  }
}

// 실행
clearDigitalResidue();
