Veja mais. Exponha menos.

Os sites podem descobrir muito mais sobre o seu navegador do que aquilo que você digita em um formulário. Eles podem consultar geolocalização, idioma, fuso horário, tamanho da tela, características do dispositivo e outros detalhes do ambiente. Até informações gráficas expostas pelo WebGL podem fazer parte de uma impressão digital reconhecível do navegador.

O Privacy Thing oferece controle prático sobre essa camada da sua privacidade. Ele mostra quais informações e recursos do navegador a página aberta acessa e permite decidir quais informações selecionadas ela poderá ver — com regras separadas para cada site.

Em resumo
==================================================

1. O Privacy Thing permite controlar as informações que o navegador fornece a sites e aplicativos web.
2. Você pode ver quais dados foram usados e quantas vezes.
3. É possível criar vários conjuntos de regras, separadamente para cada site.
4. Você pode criar diferentes configurações de localização com base na posição geográfica, nos idiomas disponíveis e nas preferências regionais. O Privacy Thing inclui um simulador completo de localização por GPS com um modelo de movimento realista.
5. O Privacy Thing foi desenvolvido para oferecer o máximo possível de recursos sem depender de conexão com serviços externos. Suas configurações continuam sendo suas.

O que o Privacy Thing oferece
==================================================

1. Reduza elementos selecionados da impressão digital do navegador

Dependendo do navegador e da configuração, o Privacy Thing pode controlar ou modificar informações selecionadas relacionadas ao navegador, à tela e ao hardware, além de canvas, WebGL, áudio, WebRTC, frames e workers. Isso inclui alguns dados que podem revelar características do hardware gráfico.

O Privacy Thing oferece ferramentas concretas para limitar e organizar as informações que estão ao alcance da extensão.

2. Veja quais informações o site consulta

O X-Ray, painel de diagnóstico integrado, mostra se o site acessou geolocalização, idioma, dados da tela, canvas, WebGL, áudio, WebRTC ou determinados mecanismos de workers. Você também vê qual perfil foi aplicado e se alguma categoria compatível apresentou um problema.

Não é um registro completo de tudo o que o site faz. É uma visão prática das áreas do navegador que o Privacy Thing consegue reconhecer e controlar.

3. Defina suas próprias regras para cada site

Crie perfis e associe-os a domínios ou padrões de domínio. Use uma regra padrão, adicione exceções para sites específicos e desative temporariamente o Privacy Thing sem apagar sua configuração. Você também pode usar a extensão apenas nos sites que escolher — o Privacy Thing não obriga você a seguir um único modelo de uso.

4. Crie perfis regionais coerentes

Um perfil pode combinar coordenadas, precisão da geolocalização e raio de variação das coordenadas, idioma principal, lista de idiomas e fuso horário. O assistente da primeira execução permite escolher rapidamente predefinições regionais prontas, e seus próprios perfis continuam totalmente editáveis.

O mecanismo Refract pode alinhar, entre outros, Geolocation API, navigator.language, navigator.languages, Date, Intl e Accept-Language. Assim, o site não precisa ver uma mistura aleatória de localização de um país, idioma de outro e fuso horário de um terceiro.

5. Use dados realistas sem consultas de rede desnecessárias

Cada versão do Privacy Thing inclui pequenos catálogos locais criados a partir de conjuntos de dados públicos processados. Com eles, a extensão pode escolher por conta própria, sem solicitações adicionais, perfis de hardware estatisticamente plausíveis com resoluções de tela, quantidades de núcleos de CPU e valores de memória disponível adequados.

O Privacy Thing também pode alternar a versão do navegador visível para um site usando um catálogo de versões reais do Chromium. A extensão ainda inclui catálogos de códigos de idioma aceitos pelos navegadores e de idiomas oficiais.

Esses conjuntos acompanham a extensão e são renovados periodicamente pelas atualizações. Durante o uso normal dos perfis, o Privacy Thing não precisa consultar as fontes originais. O fuso horário também pode ser calculado localmente a partir das coordenadas.

6. Limpe os dados do site que você escolher

O Privacy Thing pode limpar os dados do domínio atual, incluindo cookies, localStorage, sessionStorage, IndexedDB, Cache Storage e service workers. Isso é útil tanto para privacidade quanto para testar um site a partir de um estado limpo. Quando a operação termina, o perfil recebe um conjunto totalmente diferente de parâmetros, o que deve dificultar bastante o acompanhamento da atividade pelo site.

Seus dados. Sua decisão.
==================================================

Perfis, regras e configurações ficam armazenados localmente no navegador. Os recursos principais não exigem conta nem servidor do Privacy Thing. A extensão não coleta telemetria própria e não vende dados.

Predefinições, catálogos locais e coordenadas inseridas manualmente funcionam sem consultar serviços de mapas. O Privacy Thing só usa OpenStreetMap Nominatim e OpenFreeMap quando você decide ativar a busca de lugares ou a prévia do mapa. Essa escolha pode ser alterada depois.

A privacidade funciona em camadas
==================================================

O Privacy Thing controla informações selecionadas que os sites leem diretamente pelas interfaces do navegador. Ele não muda seu endereço IP público, não redireciona nem criptografa o tráfego e não substitui VPN, proxy ou Smart DNS.

Essas ferramentas resolvem outras partes do problema e podem se complementar. VPN, proxy ou Smart DNS atuam na rede ou na resolução de nomes; o Privacy Thing cuida do que o site enxerga pelas APIs do navegador.

O Privacy Thing não garante anonimato nem que as alterações sejam indetectáveis. Os sites também podem usar endereço IP, dados da conta, sessões e outras informações fora do controle da extensão. O X-Ray mostra atividade apenas nas categorias cobertas pelo Privacy Thing: não é uma análise completa do site.
