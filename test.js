const { variancia, desvio_padrao, covar, rmse, linear_reg, predict } = require('./script');

const SERIEA = [1, 2, 3, 4, 5, 6]
const SERIEB = [2, 4, 6, 8, 10, 12]

const round = n => parseFloat(n.toFixed(1))



test(
    'Verifica o calculo de variância',
    () => { expect(round(variancia(SERIEA))).toBe(2.9); }
);
test(
    'Verifica o calculo de variância',
    () => { expect(round(variancia(SERIEB))).toBe(11.7); }
);
test(
    'Verifica o calculo de desvio padrão',
    () => { expect(round(desvio_padrao(SERIEA))).toBe(1.7); }
);
test(
    'Verifica o calculo de desvio padrão',
    () => { expect(round(desvio_padrao(SERIEB))).toBe(3.4); }
);
test(
    'Verifica o calculo de covariância',
    () => { expect(round(covar(SERIEA, SERIEB))).toBe(5.8); }
);
test(
    'Verifica o calculo de RMSE',
    () => { expect(round(rmse(SERIEA, SERIEB))).toBe(3.9); }
);
test(
    'Verifica o calculo da Regressão',
    () => { expect(linear_reg(SERIEA, SERIEB)).toMatchObject({ slope: 2, intercept: 0 }); }
);
test(
    'Verifica o calculo da Regressão',
    () => { expect(linear_reg(SERIEB, SERIEA)).toMatchObject({ slope: 0.5, intercept: 0 }); }
);
test(
    'Verifica o calculo da calibração',
    () => { 
        expect(predict(linear_reg(SERIEA, SERIEB), SERIEA)).toMatchObject(SERIEB);
    }
);
test(
    'Verifica o calculo da calibração',
    () => { 
        expect(predict(linear_reg(SERIEB, SERIEA), SERIEB)).toMatchObject(SERIEA);
    }
);
