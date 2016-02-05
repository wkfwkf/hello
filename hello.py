import numpy as np

def helloworld():
    print("hello world")

def find_spreads(log_etfprices, log_basket,lookback, vec):
    spread_list = np.concatenate((np.array([log_etfprices]).T,np.array([log_basket]).T),axis=1).dot(vec)
    lookback_spread = spread_list[-1*lookback:]    
    
    return np.mean(lookback_spread), np.std(lookback_spread)
if __name__ == '__main__':
    #helloworld()
    
    a = np.array([1,2,3,4])
    b = 5
    a = np.append(a[1:],b)
    vec = [1,-0.3]
    print(a[-2:])
    lookback = 3
    #print(find_spreads(a,b,lookback,vec))
    
    print(a)